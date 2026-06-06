import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { BinaryFormPanel } from "./components/BinaryFormPanel";
import { CalibrationOverlay } from "./components/CalibrationOverlay";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { FormImportPanel } from "./components/FormImportPanel";
import { GazeDiagnosticsPanel } from "./components/GazeDiagnosticsPanel";
import { useCameraStream } from "./hooks/useCameraStream";
import { useDwellSelection } from "./hooks/useDwellSelection";
import { useGazeProvider } from "./hooks/useGazeProvider";
import { importGoogleForm, submitGoogleForm } from "./lib/api";
import { resolveBinaryDecisionTarget } from "./lib/decisionZone";
import { createInitialFormFlowState, formFlowReducer } from "./lib/formFlow";
import {
  applyCalibrationToFrame,
  averageFeatureVectors,
  buildCalibrationTelemetry,
  buildCalibrationModelV2,
  createEmptyCalibrationModelV2,
  getFeatureWindowSpread,
  isFeatureWindowStable,
  type CalibrationModelV2,
} from "./lib/gazeCalibrationV2";
import { resolveCalibrationTarget } from "./lib/calibration";
import type { ProviderMode } from "./lib/gazeProvider";
import type { CalibrationSampleV2, GazeFeatureVector, GazeFrame, GazePoint } from "./types";

const calibrationHoldMs = 2200;
const calibrationMinPointMs = 1400;
const calibrationMaxPointMs = 6500;
const calibrationSampleIntervalMs = 100;
const calibrationFeatureStability = 0.14;
const calibrationMinValidFrames = 12;
const minimumCalibrationConfidence = 0.45;
const calibrationSequence = [4, 1, 7, 3, 5, 0, 2, 6, 8] as const;
const calibrationFallbackMinFrames = 6;
const calibrationFallbackQualityMultiplier = 0.8;
const calibrationSettleMs = 900;
const calibrationWindowSize = 18;

function averageQuality(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampPointToViewport(point: GazePoint | null) {
  if (!point) {
    return null;
  }

  return {
    x: Math.min(Math.max(point.x, 24), window.innerWidth - 24),
    y: Math.min(Math.max(point.y, 24), window.innerHeight - 24),
  };
}

export default function App() {
  const [formUrl, setFormUrl] = useState("");
  const [activeFormUrl, setActiveFormUrl] = useState("");
  const [formFlow, dispatchFormFlow] = useReducer(formFlowReducer, undefined, createInitialFormFlowState);
  const [providerMode, setProviderMode] = useState<ProviderMode>("mediapipe");
  const [dwellMs, setDwellMs] = useState(3000);
  const [neutralZonePercent, setNeutralZonePercent] = useState(24);
  const [highContrast, setHighContrast] = useState(false);
  const [usePitchAssist, setUsePitchAssist] = useState(true);
  const [invertVerticalAxis, setInvertVerticalAxis] = useState(false);
  const [horizontalSensitivity, setHorizontalSensitivity] = useState(1.2);
  const [verticalSensitivity, setVerticalSensitivity] = useState(1.2);
  const [stabilization, setStabilization] = useState(82);
  const [statusMessage, setStatusMessage] = useState("Listo para calibrar e importar un formulario.");
  const [importingForm, setImportingForm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSampleV2[]>([]);
  const [calibrationScore, setCalibrationScore] = useState(0);
  const [calibrationModel, setCalibrationModel] = useState<CalibrationModelV2>(createEmptyCalibrationModelV2());
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationDebugLogs, setCalibrationDebugLogs] = useState<string[]>([]);
  const [smoothedPoint, setSmoothedPoint] = useState<GazePoint | null>(null);

  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<GazeFrame | null>(null);
  const calibrationSamplesRef = useRef<CalibrationSampleV2[]>([]);
  const calibrationLogBufferRef = useRef<string[]>([]);
  const featureWindowRef = useRef<GazeFeatureVector[]>([]);
  const qualityWindowRef = useRef<number[]>([]);
  const correctedPointWindowRef = useRef<GazePoint[]>([]);

  const camera = useCameraStream({ enabled: providerMode === "mediapipe" });
  const mappingOptions = useMemo(
    () => ({
      usePitchAssist,
      invertVertical: invertVerticalAxis,
    }),
    [invertVerticalAxis, usePitchAssist],
  );
  const { frame, ready, providerLabel, error, stage, debugLogs } = useGazeProvider({
    mode: providerMode,
    enabled: providerMode === "pointer" || camera.ready,
    videoRef: camera.videoRef,
    overlayRef,
    mappingOptions,
  });

  const activeStep = formFlow.steps[formFlow.currentStepIndex] ?? null;
  const rawPoint = frame?.rawPoint ?? null;
  const correctedPoint = useMemo(() => {
    if (!frame) {
      return null;
    }

    if (frame.features && calibrationModel.sampleCount >= 4) {
      return applyCalibrationToFrame(frame.features, calibrationModel, {
        horizontalSensitivity,
        verticalSensitivity,
      });
    }

    return rawPoint;
  }, [calibrationModel, frame, horizontalSensitivity, rawPoint, verticalSensitivity]);
  const telemetry = useMemo(() => {
    if (!frame?.features) {
      return null;
    }

    return buildCalibrationTelemetry(frame.features, calibrationModel, {
      horizontalSensitivity,
      verticalSensitivity,
    });
  }, [calibrationModel, frame?.features, horizontalSensitivity, verticalSensitivity]);
  const combinedDebugLogs = useMemo(
    () => [...debugLogs, ...calibrationDebugLogs].slice(-80),
    [calibrationDebugLogs, debugLogs],
  );

  const appendCalibrationLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("es-ES", { hour12: false });
    const entry = `${timestamp} | calibration | ${message}`;
    console.info(`[Calibration] ${entry}`);
    calibrationLogBufferRef.current = [...calibrationLogBufferRef.current, entry].slice(-50);
    setCalibrationDebugLogs(calibrationLogBufferRef.current);
  }, []);

  const actionablePoint = useMemo(() => {
    if (
      calibrationActive ||
      formFlow.status !== "answering" ||
      !frame ||
      !smoothedPoint ||
      !frame.irisDetected ||
      frame.confidence < minimumCalibrationConfidence
    ) {
      return null;
    }

    return clampPointToViewport(smoothedPoint);
  }, [calibrationActive, formFlow.status, frame, smoothedPoint]);

  const displayPoint = useMemo(() => {
    if (calibrationActive) {
      return clampPointToViewport(rawPoint);
    }

    return clampPointToViewport(smoothedPoint ?? correctedPoint);
  }, [calibrationActive, correctedPoint, rawPoint, smoothedPoint]);

  const handleAnswerYes = useCallback(() => {
    const label = activeStep?.optionLabel;
    dispatchFormFlow({ type: "answerYes" });
    setStatusMessage(label ? `Respuesta registrada: Si a "${label}".` : "Respuesta Si registrada.");
  }, [activeStep?.optionLabel]);

  const handleAnswerNo = useCallback(() => {
    const label = activeStep?.optionLabel;
    dispatchFormFlow({ type: "answerNo" });
    setStatusMessage(label ? `Respuesta registrada: No a "${label}".` : "Respuesta No registrada.");
  }, [activeStep?.optionLabel]);

  const handleActivateTarget = useCallback(
    (targetId: string) => {
      if (targetId === "decision-yes") {
        handleAnswerYes();
      }
      if (targetId === "decision-no") {
        handleAnswerNo();
      }
    },
    [handleAnswerNo, handleAnswerYes],
  );

  const { focusedKeyId, dwellProgress, registerTarget, resetDwell } = useDwellSelection({
    gazePoint: actionablePoint,
    dwellMs,
    snapRadius: calibrationModel.sampleCount >= 4 ? 180 : 240,
    onActivate: handleActivateTarget,
    resolveTargetId: (gazePoint, targets) => resolveBinaryDecisionTarget(gazePoint, targets),
  });

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    if (!correctedPoint) {
      correctedPointWindowRef.current = [];
      setSmoothedPoint(null);
      return;
    }

    correctedPointWindowRef.current = [...correctedPointWindowRef.current, correctedPoint].slice(-5);
    const medianX = [...correctedPointWindowRef.current.map((point) => point.x)].sort((a, b) => a - b)[
      Math.floor(correctedPointWindowRef.current.length / 2)
    ];
    const medianY = [...correctedPointWindowRef.current.map((point) => point.y)].sort((a, b) => a - b)[
      Math.floor(correctedPointWindowRef.current.length / 2)
    ];
    const filteredPoint = { x: medianX, y: medianY };

    setSmoothedPoint((previousPoint) => {
      if (!previousPoint) {
        return filteredPoint;
      }

      const alpha = Math.max(0.08, (100 - stabilization) / 100);
      return {
        x: previousPoint.x + (filteredPoint.x - previousPoint.x) * alpha,
        y: previousPoint.y + (filteredPoint.y - previousPoint.y) * alpha,
      };
    });
  }, [correctedPoint, stabilization]);

  useEffect(() => {
    calibrationSamplesRef.current = calibrationSamples;
  }, [calibrationSamples]);

  useEffect(() => {
    if (camera.error) {
      setStatusMessage(`Webcam no disponible: ${camera.error}`);
    }
  }, [camera.error]);

  useEffect(() => {
    if (!formFlow.form) {
      window.localStorage.removeItem("eyespeak-form-progress");
      return;
    }

    window.localStorage.setItem(
      "eyespeak-form-progress",
      JSON.stringify({
        form_id: formFlow.form.form_id,
        title: formFlow.form.title,
        answers: formFlow.answers,
        currentStepIndex: formFlow.currentStepIndex,
        status: formFlow.status,
      }),
    );
  }, [formFlow.answers, formFlow.currentStepIndex, formFlow.form, formFlow.status]);

  const handleImportForm = useCallback(async () => {
    const trimmedUrl = formUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    setImportingForm(true);
    setImportError(null);
    setSubmitMessage(null);
    setStatusMessage("Importando formulario...");

    try {
      const importedForm = await importGoogleForm(trimmedUrl);
      setActiveFormUrl(trimmedUrl);
      dispatchFormFlow({ type: "loadForm", form: importedForm });
      resetDwell();
      setStatusMessage(`Formulario importado: ${importedForm.title}.`);
    } catch {
      setImportError("No se pudo importar el formulario. Debe ser publico, de Google/Microsoft Forms y tener opciones multiples o casillas.");
      setStatusMessage("Importacion fallida.");
    } finally {
      setImportingForm(false);
    }
  }, [formUrl, resetDwell]);

  const handleSubmitForm = useCallback(async () => {
    if (!formFlow.form || !activeFormUrl) {
      return;
    }

    setSubmittingForm(true);
    setSubmitMessage(null);
    setStatusMessage("Enviando respuestas al formulario...");

    try {
      const response = await submitGoogleForm(activeFormUrl, formFlow.form.submit_url, formFlow.answers);
      setSubmitMessage(response.message);
      if (response.submitted) {
        dispatchFormFlow({ type: "markSubmitted" });
      }
      setStatusMessage(response.message);
    } catch {
      setSubmitMessage("No se pudo enviar. Revisa si el formulario requiere login o usa campos no soportados.");
      setStatusMessage("Envio fallido.");
    } finally {
      setSubmittingForm(false);
    }
  }, [activeFormUrl, formFlow.answers, formFlow.form]);

  const handleResetForm = useCallback(() => {
    dispatchFormFlow({ type: "reset" });
    setFormUrl("");
    setActiveFormUrl("");
    setImportError(null);
    setSubmitMessage(null);
    setStatusMessage("Formulario reiniciado.");
    resetDwell();
  }, [resetDwell]);

  const handleStartCalibration = useCallback(() => {
    setCalibrationActive(true);
    setCalibrationIndex(0);
    setCalibrationSamples([]);
    calibrationSamplesRef.current = [];
    calibrationLogBufferRef.current = [];
    setCalibrationDebugLogs([]);
    featureWindowRef.current = [];
    qualityWindowRef.current = [];
    setCalibrationProgress(0);
    setCalibrationScore(0);
    setCalibrationModel(createEmptyCalibrationModelV2());
    setStatusMessage("Calibracion automatica iniciada. Mantener la mirada fija en cada punto hasta que avance.");
    appendCalibrationLog(
      `inicio | puntos=${calibrationSequence.length} minFrames=${calibrationMinValidFrames} fallbackFrames=${calibrationFallbackMinFrames} estabilidad=${calibrationFeatureStability}`,
    );
    resetDwell();
  }, [appendCalibrationLog, resetDwell]);

  useEffect(() => {
    if (!calibrationActive) {
      return;
    }

    let startedAt = Date.now();
    let lastProgressSecond = -1;
    featureWindowRef.current = [];
    qualityWindowRef.current = [];
    setCalibrationProgress(0);
    appendCalibrationLog(`punto ${calibrationIndex + 1}/${calibrationSequence.length} iniciado`);

    const intervalId = window.setInterval(() => {
      const currentFrame = frameRef.current;
      const elapsedMs = Date.now() - startedAt;

      if (
        currentFrame?.features &&
        currentFrame.irisDetected &&
        !currentFrame.diagnostics.blink &&
        currentFrame.confidence >= minimumCalibrationConfidence &&
        elapsedMs >= calibrationSettleMs
      ) {
        featureWindowRef.current.push(currentFrame.features);
        qualityWindowRef.current.push(currentFrame.confidence);
        if (featureWindowRef.current.length > calibrationWindowSize) {
          featureWindowRef.current.shift();
        }
        if (qualityWindowRef.current.length > calibrationWindowSize) {
          qualityWindowRef.current.shift();
        }
      }

      const progress = Math.min(elapsedMs / calibrationHoldMs, 1);
      const validFrames = featureWindowRef.current.length;

      setCalibrationProgress(progress);

      const stable = isFeatureWindowStable(featureWindowRef.current, calibrationFeatureStability);
      const averagedFeatures = averageFeatureVectors(featureWindowRef.current);
      const quality = averageQuality(qualityWindowRef.current);
      const spread = getFeatureWindowSpread(featureWindowRef.current);
      const shouldTimeout = elapsedMs >= calibrationMaxPointMs;
      const fallbackCapture =
        shouldTimeout &&
        Boolean(averagedFeatures) &&
        validFrames >= calibrationFallbackMinFrames &&
        quality >= minimumCalibrationConfidence * calibrationFallbackQualityMultiplier;
      const shouldCapture =
        stable &&
        averagedFeatures &&
        validFrames >= calibrationMinValidFrames &&
        elapsedMs >= calibrationMinPointMs;
      const progressSecond = Math.floor(elapsedMs / 1000);

      if (progressSecond !== lastProgressSecond) {
        lastProgressSecond = progressSecond;
        appendCalibrationLog(
          `punto ${calibrationIndex + 1} | t=${(elapsedMs / 1000).toFixed(1)}s frames=${validFrames} estable=${stable ? "si" : "no"} spread=${spread.toFixed(3)} calidad=${Math.round(quality * 100)}%`,
        );
      }

      if (!shouldCapture && !fallbackCapture && !shouldTimeout) {
        setStatusMessage(
          `Calibracion en curso. Punto ${calibrationIndex + 1} de ${calibrationSequence.length}. Frames validos: ${validFrames}/${calibrationMinValidFrames}.`,
        );
        return;
      }

      const pointIndex = calibrationSequence[calibrationIndex];
      const target = resolveCalibrationTarget(pointIndex, window.innerWidth, window.innerHeight);

      featureWindowRef.current = [];
      qualityWindowRef.current = [];

      const captureMode = shouldCapture ? "estable" : fallbackCapture ? "timeout-fallback" : "descartada";
      const capturedQuality = fallbackCapture ? quality * calibrationFallbackQualityMultiplier : quality;
      const nextSamples =
        (shouldCapture || fallbackCapture) && averagedFeatures
          ? [...calibrationSamplesRef.current, { features: averagedFeatures, target, quality: capturedQuality }]
          : calibrationSamplesRef.current;

      appendCalibrationLog(
        `punto ${calibrationIndex + 1} finalizado | modo=${captureMode} frames=${validFrames} estable=${stable ? "si" : "no"} spread=${spread.toFixed(3)} calidad=${Math.round(quality * 100)}% muestras=${nextSamples.length}`,
      );
      calibrationSamplesRef.current = nextSamples;
      setCalibrationSamples(nextSamples);

      if (calibrationIndex >= calibrationSequence.length - 1) {
        const nextModel = buildCalibrationModelV2(nextSamples);
        setCalibrationModel(nextModel);
        setCalibrationScore(nextModel.score);
        setCalibrationActive(false);
        setCalibrationProgress(0);
        appendCalibrationLog(
          `modelo final | muestras=${nextModel.sampleCount} score=${Math.round(nextModel.score * 100)}% rangoX=${
            nextModel.axisRangeX
              ? `${Math.round(nextModel.axisRangeX.targetMin)}-${Math.round(nextModel.axisRangeX.targetMax)} inv=${nextModel.axisRangeX.invert ? "si" : "no"}`
              : "null"
          } rangoY=${
            nextModel.axisRangeY
              ? `${Math.round(nextModel.axisRangeY.targetMin)}-${Math.round(nextModel.axisRangeY.targetMax)} inv=${nextModel.axisRangeY.invert ? "si" : "no"}`
              : "null"
          }`,
        );

        if (nextSamples.length < 4) {
          appendCalibrationLog("resultado insuficiente | menos de 4 muestras capturadas");
          setStatusMessage(
            "Calibracion completada con datos insuficientes. Repite el proceso con mejor iluminacion y manteniendo la cabeza estable.",
          );
          return;
        }

        setStatusMessage(`Calibracion completada. Precision estimada: ${Math.round(nextModel.score * 100)}%.`);
        return;
      }

      setCalibrationIndex((value) => value + 1);
      startedAt = Date.now();

      if ((!shouldCapture && !fallbackCapture) || !averagedFeatures) {
        setStatusMessage(
          `La muestra del punto ${calibrationIndex + 1} no fue estable o no hubo suficientes frames utiles. Continuando con el punto ${calibrationIndex + 2}.`,
        );
        return;
      }

      setStatusMessage(
        `Calibracion en curso. Punto ${calibrationIndex + 2} de ${calibrationSequence.length}. Muestras validas: ${nextSamples.length}.`,
      );
    }, calibrationSampleIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appendCalibrationLog, calibrationActive, calibrationIndex]);

  const answeredCount = Object.values(formFlow.answers).reduce((total, values) => total + values.length, 0);
  const compatibleQuestionCount = formFlow.form?.questions.length ?? 0;
  const binaryStepCount = formFlow.steps.length;

  return (
    <div className={`app-shell${highContrast ? " app-shell--contrast" : ""}`}>
      {calibrationActive ? (
        <CalibrationOverlay
          activeIndex={calibrationIndex}
          activePointIndex={calibrationSequence[calibrationIndex]}
          total={calibrationSequence.length}
          progress={calibrationProgress}
        />
      ) : null}

      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">EyeSpeak Forms</p>
          <h1>Responde formularios con la mirada.</h1>
          <p className="hero__lead">
            Importa un Google Forms o Microsoft Forms publico y responde cada opcion con una decision binaria: izquierda para No,
            derecha para Si, centro para descansar.
          </p>
        </div>

        <div className="hero__controls">
          <label className="control-group">
            <span>Modo de entrada</span>
            <select value={providerMode} onChange={(event) => setProviderMode(event.target.value as ProviderMode)}>
              <option value="mediapipe">Webcam + MediaPipe</option>
              <option value="pointer">Simulacion con puntero</option>
            </select>
          </label>
          <label className="control-group">
            <span>Dwell</span>
            <input type="range" min="1000" max="5000" step="100" value={dwellMs} onChange={(event) => setDwellMs(Number(event.target.value))} />
            <strong>{dwellMs} ms</strong>
          </label>
          <label className="control-group">
            <span>Zona neutra</span>
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={neutralZonePercent}
              onChange={(event) => setNeutralZonePercent(Number(event.target.value))}
            />
            <strong>{neutralZonePercent}%</strong>
          </label>
          <label className="control-group">
            <span>Estabilizacion</span>
            <input
              type="range"
              min="55"
              max="92"
              step="1"
              value={stabilization}
              onChange={(event) => setStabilization(Number(event.target.value))}
            />
            <strong>{stabilization}%</strong>
          </label>
          <label className="control-group">
            <span>Sensibilidad X</span>
            <input
              type="range"
              min="0.8"
              max="4"
              step="0.05"
              value={horizontalSensitivity}
              onChange={(event) => setHorizontalSensitivity(Number(event.target.value))}
            />
            <strong>{horizontalSensitivity.toFixed(2)}x</strong>
          </label>
          <label className="control-group">
            <span>Sensibilidad Y</span>
            <input
              type="range"
              min="0.8"
              max="4"
              step="0.05"
              value={verticalSensitivity}
              onChange={(event) => setVerticalSensitivity(Number(event.target.value))}
            />
            <strong>{verticalSensitivity.toFixed(2)}x</strong>
          </label>
          <label className="control-group control-group--toggle">
            <span>Contraste alto</span>
            <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
          </label>
          <label className="control-group control-group--toggle">
            <span>Usar pitch</span>
            <input type="checkbox" checked={usePitchAssist} onChange={(event) => setUsePitchAssist(event.target.checked)} />
          </label>
          <label className="control-group control-group--toggle">
            <span>Invertir eje vertical</span>
            <input
              type="checkbox"
              checked={invertVerticalAxis}
              onChange={(event) => setInvertVerticalAxis(event.target.checked)}
            />
          </label>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace-main">
          <CalibrationPanel calibrated={!calibrationActive && calibrationModel.sampleCount >= 4} onCalibrate={handleStartCalibration} />
          <FormImportPanel
            formUrl={formUrl}
            importing={importingForm}
            error={importError}
            onUrlChange={setFormUrl}
            onImport={handleImportForm}
          />
          <BinaryFormPanel
            form={formFlow.form}
            step={activeStep}
            answers={formFlow.answers}
            status={formFlow.status}
            focusedTargetId={focusedKeyId}
            dwellProgress={dwellProgress}
            neutralZonePercent={neutralZonePercent}
            submitting={submittingForm}
            submitMessage={submitMessage}
            registerTarget={registerTarget}
            onAnswerYes={handleAnswerYes}
            onAnswerNo={handleAnswerNo}
            onBack={() => dispatchFormFlow({ type: "goBack" })}
            onSubmit={handleSubmitForm}
            onReset={handleResetForm}
          />
        </section>
      </main>

      <section className="workspace-side">
        <GazeDiagnosticsPanel
          mode={providerMode === "pointer" ? "pointer" : "mediapipe"}
          frame={frame}
          videoRef={camera.videoRef}
          overlayRef={overlayRef}
          cameraReady={camera.ready}
          cameraError={camera.error}
          telemetry={telemetry}
        />

        <section className="status-card">
          <p className="eyebrow">Estado</p>
          <h3>{providerLabel}</h3>
          <ul>
            <li>{ready ? "Seguimiento listo" : "Inicializando proveedor"}</li>
            <li>Etapa: {stage}</li>
            <li>{error ?? camera.error ?? "Sin errores detectados"}</li>
            <li>{statusMessage}</li>
            <li>Formulario: {formFlow.form?.title ?? "sin importar"}</li>
            <li>Proveedor: {formFlow.form?.provider ?? "--"}</li>
            <li>Preguntas compatibles: {compatibleQuestionCount}</li>
            <li>Pasos binarios: {binaryStepCount}</li>
            <li>Respuestas seleccionadas: {answeredCount}</li>
            <li>Zona neutra central: {neutralZonePercent}%</li>
            <li>Score de calibracion: {Math.round(calibrationScore * 100)}%</li>
            <li>Muestras de calibracion: {calibrationModel.sampleCount}</li>
            <li>{usePitchAssist ? "Pitch asistido activo" : "Pitch asistido desactivado"}</li>
            <li>{invertVerticalAxis ? "Eje vertical invertido" : "Eje vertical normal"}</li>
            <li>Sensibilidad X: {horizontalSensitivity.toFixed(2)}x</li>
            <li>Sensibilidad Y: {verticalSensitivity.toFixed(2)}x</li>
            <li>
              {calibrationModel.axisRangeX
                ? `Rango X activo: ${Math.round(calibrationModel.axisRangeX.targetMin)}-${Math.round(calibrationModel.axisRangeX.targetMax)}`
                : "Rango X no calibrado"}
            </li>
            <li>
              {calibrationModel.axisRangeY
                ? `Rango Y activo: ${Math.round(calibrationModel.axisRangeY.targetMin)}-${Math.round(calibrationModel.axisRangeY.targetMax)}`
                : "Rango Y no calibrado"}
            </li>
            <li>
              {telemetry?.normalizedX !== null && telemetry?.normalizedX !== undefined
                ? `Norm X viva: ${telemetry.normalizedX.toFixed(3)}`
                : "Norm X viva: --"}
            </li>
            <li>
              {telemetry?.normalizedY !== null && telemetry?.normalizedY !== undefined
                ? `Norm Y viva: ${telemetry.normalizedY.toFixed(3)}`
                : "Norm Y viva: --"}
            </li>
            <li>Estabilizacion: {stabilization}%</li>
          </ul>
        </section>

        <section className="status-card status-card--debug">
          <p className="eyebrow">Logs Eye Tracking</p>
          <h3>Traza de arranque</h3>
          {combinedDebugLogs.length > 0 ? (
            <div className="debug-log-list">
              {combinedDebugLogs.map((entry) => (
                <code key={entry} className="debug-log-entry">
                  {entry}
                </code>
              ))}
            </div>
          ) : (
            <p className="debug-log-empty">Aun no hay logs disponibles.</p>
          )}
        </section>

        <section className="status-card">
          <p className="eyebrow">Consejos</p>
          <ul>
            <li>Usa una webcam a la altura de los ojos.</li>
            <li>Manten la cabeza estable durante la calibracion.</li>
            <li>Comprueba en la tarjeta de camara que aparecen mesh, caja facial e iris.</li>
            <li>Usa la zona central para descansar la vista sin seleccionar respuestas.</li>
          </ul>
        </section>
      </section>

      <div className="gaze-hud">
        <strong>Seguimiento visual</strong>
        <span>{calibrationModel.sampleCount >= 4 ? "calibrada" : calibrationActive ? "sin calibrar" : "sin calibrar"}</span>
        <span>{ready ? providerLabel : "inicializando proveedor"}</span>
        <span>{displayPoint ? `X ${Math.round(displayPoint.x)} - Y ${Math.round(displayPoint.y)}` : "Esperando coordenadas de mirada"}</span>
        <span>{frame?.irisDetected ? `Confianza ${Math.round(frame.confidence * 100)}%` : "Esperando landmarks de iris"}</span>
      </div>

      {displayPoint ? (
        <div className="gaze-cursor" style={{ left: `${displayPoint.x}px`, top: `${displayPoint.y}px` }}>
          <span className="gaze-cursor__ring" />
          <span className="gaze-cursor__dot" />
        </div>
      ) : null}
    </div>
  );
}
