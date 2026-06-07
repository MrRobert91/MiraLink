import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AppNavigation } from "./components/AppNavigation";
import { AnsweringToolbar } from "./components/AnsweringToolbar";
import { BinaryFormPanel } from "./components/BinaryFormPanel";
import { GazeOverlayPreview } from "./components/GazeOverlayPreview";
import { CalibrationCameraBackdrop } from "./components/CalibrationCameraBackdrop";
import { CalibrationInstructions } from "./components/CalibrationInstructions";
import { CalibrationOverlay } from "./components/CalibrationOverlay";
import { EyeRestOverlay } from "./components/EyeRestOverlay";
import { CustomQuestionOverlay } from "./components/CustomQuestionOverlay";
import { AdminPanel } from "./components/AdminPanel";
import { FormImportPanel } from "./components/FormImportPanel";
import { SettingsPage } from "./components/SettingsPage";
import { useCameraStream } from "./hooks/useCameraStream";
import { useDwellSelection } from "./hooks/useDwellSelection";
import { useGazeProvider } from "./hooks/useGazeProvider";
import { useSpeech } from "./hooks/useSpeech";
import { useTtsVoices } from "./hooks/useTtsVoices";
import {
  deleteSavedForm,
  getProfile,
  getSavedForms,
  importGoogleForm,
  prepareFormAudio,
  saveForm,
  submitGoogleForm,
  updateProfile,
} from "./lib/api";
import type { SubmitFormPayload } from "./lib/api";
import { REST_TARGET_ID, resolveBinaryDecisionTarget, resolveRestBand } from "./lib/decisionZone";
import { buildDecisionSteps, createInitialFormFlowState, formFlowReducer } from "./lib/formFlow";
import { BROWSER_ENGINE, voiceEngine } from "./lib/speech";
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
import { OneEuroFilter, oneEuroOptionsForStabilization } from "./lib/oneEuroFilter";
import { applyCenterPrecision } from "./lib/centerPrecision";
import {
  defaultMiraLinkPreferences,
  normalizeThemeName,
  themeOptions,
  type CalibrationSampleV2,
  type GazeFeatureVector,
  type GazeFrame,
  type GazePoint,
  type ImportedForm,
  type MiraLinkPreferences,
  type SavedForm,
  type ThemeName,
} from "./types";

const calibrationHoldMs = 2200;
const calibrationMinPointMs = 1400;
const calibrationMaxPointMs = 6500;
const calibrationSampleIntervalMs = 100;
const calibrationFeatureStability = 0.14;
const calibrationMinValidFrames = 12;
const minimumCalibrationConfidence = 0.45;
// Orden de visita: centro, bordes cardinales, esquinas y, por último, los dos
// puntos intermedios del eje horizontal medio (índices 4 y 6).
const calibrationSequence = [5, 1, 9, 3, 7, 0, 2, 8, 10, 4, 6] as const;
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
  const navigate = useNavigate();
  const location = useLocation();
  const [formUrl, setFormUrl] = useState("");
  const [activeFormUrl, setActiveFormUrl] = useState("");
  const [formFlow, dispatchFormFlow] = useReducer(formFlowReducer, undefined, createInitialFormFlowState);
  const [providerMode, setProviderMode] =
    useState<MiraLinkPreferences["provider_mode"]>("mediapipe");
  const [dwellMs, setDwellMs] = useState(3000);
  const [neutralZonePercent, setNeutralZonePercent] = useState(24);
  const [theme, setTheme] = useState<ThemeName>("light");
  const [usePitchAssist, setUsePitchAssist] = useState(true);
  const [invertVerticalAxis, setInvertVerticalAxis] = useState(false);
  const [horizontalSensitivity, setHorizontalSensitivity] = useState(1.2);
  const [verticalSensitivity, setVerticalSensitivity] = useState(1.2);
  const [stabilization, setStabilization] = useState(82);
  const [cameraOpacity, setCameraOpacity] = useState(35);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [centerPrecision, setCenterPrecision] = useState(50);
  const [eyeRestEnabled, setEyeRestEnabled] = useState(true);
  const [eyeRestTriggerSeconds, setEyeRestTriggerSeconds] = useState(10);
  const [eyeRestPauseSeconds, setEyeRestPauseSeconds] = useState(60);
  const [eyeRestPhase, setEyeRestPhase] = useState<"idle" | "prompt" | "resting">("idle");
  const [eyeRestFollowUp, setEyeRestFollowUp] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsRate, setTtsRate] = useState(1);
  // Mapa texto -> URL de audio preparada para voces de backend (Piper, …).
  const [ttsAudioUrls, setTtsAudioUrls] = useState<Record<string, string>>({});
  const [customQuestionPhase, setCustomQuestionPhase] = useState<"idle" | "compose" | "asking">("idle");
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [auxiliaryAnswers, setAuxiliaryAnswers] = useState<{ question: string; answer: "Sí" | "No" }[]>([]);
  const [statusMessage, setStatusMessage] = useState("Listo para calibrar e importar un formulario.");
  const [importingForm, setImportingForm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [formSubmissionId, setFormSubmissionId] = useState<string | null>(null);
  const [formStartedAt, setFormStartedAt] = useState<number | null>(null);
  const [savedForms, setSavedForms] = useState<SavedForm[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationInstructionsOpen, setCalibrationInstructionsOpen] = useState(false);
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
  const oneEuroFilterRef = useRef<{ x: OneEuroFilter; y: OneEuroFilter } | null>(null);

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

    const point =
      frame.features && calibrationModel.sampleCount >= 4
        ? applyCalibrationToFrame(frame.features, calibrationModel, {
            horizontalSensitivity,
            verticalSensitivity,
          })
        : rawPoint;

    if (!point) {
      return null;
    }

    // Zona de precisión central: reduce la sensibilidad cerca del centro
    // conservando el alcance pleno en los bordes. Solo en modo mirada; con el
    // ratón (modo pointer) no hay ruido que compensar y distorsionaría el cursor.
    if (providerMode !== "mediapipe") {
      return point;
    }
    return applyCenterPrecision(point, window.innerWidth, window.innerHeight, centerPrecision);
  }, [calibrationModel, centerPrecision, frame, horizontalSensitivity, providerMode, rawPoint, verticalSensitivity]);
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
  const resolveDecisionTargetId = useCallback(
    (gazePoint: GazePoint | null, targets: Parameters<typeof resolveBinaryDecisionTarget>[1]) =>
      resolveBinaryDecisionTarget(gazePoint, targets, neutralZonePercent),
    [neutralZonePercent],
  );

  const snapRadius = calibrationModel.sampleCount >= 4 ? 180 : 240;

  const ttsVoices = useTtsVoices();
  const getAudioUrl = useCallback(
    (text: string) => ttsAudioUrls[text] ?? null,
    [ttsAudioUrls],
  );
  const { speak: speakText, cancel: cancelSpeech, isSpeaking } = useSpeech({
    voiceId: ttsVoiceId,
    rate: ttsRate,
    getAudioUrl,
  });

  // Mientras hay un overlay activo (descanso o pregunta personalizada), las
  // zonas Sí/No del formulario quedan suspendidas: no se alimenta su dwell.
  // Mientras se lee una pregunta en voz alta el dwell también se congela, para
  // que el usuario pueda escuchar sin seleccionar sin querer.
  const overlaysIdle = eyeRestPhase === "idle" && customQuestionPhase === "idle";
  const formGazePoint = overlaysIdle && !isSpeaking ? actionablePoint : null;

  const { focusedKeyId, dwellProgress, registerTarget, resetDwell } = useDwellSelection({
    gazePoint: formGazePoint,
    dwellMs,
    snapRadius,
    onActivate: handleActivateTarget,
    resolveTargetId: resolveDecisionTargetId,
  });

  // Dwell sobre la zona de descanso: si la mirada permanece en la banda central
  // el tiempo configurado, se ofrece una pausa visual.
  const handleRestDwellActivate = useCallback((targetId: string) => {
    if (targetId === REST_TARGET_ID) {
      setEyeRestFollowUp(false);
      setEyeRestPhase("prompt");
    }
  }, []);

  const resolveRestTargetId = useCallback(
    (gazePoint: GazePoint | null, targets: Parameters<typeof resolveRestBand>[0]) => {
      if (!gazePoint) {
        return null;
      }
      const band = resolveRestBand(targets, neutralZonePercent, window.innerWidth);
      return gazePoint.x >= band.left && gazePoint.x <= band.right ? REST_TARGET_ID : null;
    },
    [neutralZonePercent],
  );

  const restGazePoint = eyeRestEnabled && overlaysIdle && !isSpeaking ? actionablePoint : null;

  const { dwellProgress: restDwellProgress, resetDwell: resetRestDwell } = useDwellSelection({
    gazePoint: restGazePoint,
    dwellMs: Math.max(eyeRestTriggerSeconds, 1) * 1000,
    snapRadius,
    onActivate: handleRestDwellActivate,
    resolveTargetId: resolveRestTargetId,
  });

  // Texto que se lee por cada paso: pregunta + opción presentada.
  const stepSpeechText = (step: { questionTitle: string; optionLabel: string }) =>
    `${step.questionTitle}. ${step.optionLabel}`;

  // Para voces de backend, genera/reutiliza los audios del formulario al
  // cargarlo (generación anticipada). Con voz de navegador no hay nada que
  // preparar y `useSpeech` sintetiza al vuelo.
  const prepareTtsForForm = useCallback(
    async (form: ImportedForm) => {
      if (!ttsEnabled) {
        setTtsAudioUrls({});
        return;
      }
      const engine = ttsVoiceId ? voiceEngine(ttsVoiceId) : BROWSER_ENGINE;
      if (engine === BROWSER_ENGINE) {
        setTtsAudioUrls({});
        return;
      }
      const texts = Array.from(new Set(buildDecisionSteps(form).map(stepSpeechText)));
      try {
        const urls = await prepareFormAudio(
          form.form_id,
          ttsVoiceId,
          texts.map((text) => ({ key: text, text })),
        );
        setTtsAudioUrls(urls);
      } catch {
        // Si la preparación falla, useSpeech cae a la voz del navegador.
        setTtsAudioUrls({});
      }
    },
    [ttsEnabled, ttsVoiceId],
  );

  // Lee la pregunta + opción activas al cambiar de paso mientras se responde.
  useEffect(() => {
    if (!ttsEnabled || formFlow.status !== "answering" || !activeStep) {
      cancelSpeech();
      return;
    }
    speakText(stepSpeechText(activeStep));
  }, [ttsEnabled, formFlow.status, activeStep, speakText, cancelSpeech]);

  const handleEyeRestAccept = useCallback(() => {
    setEyeRestPhase("resting");
  }, []);

  const handleEyeRestDecline = useCallback(() => {
    setEyeRestPhase("idle");
    setEyeRestFollowUp(false);
    resetRestDwell();
    resetDwell();
  }, [resetDwell, resetRestDwell]);

  const handleEyeRestPauseComplete = useCallback(() => {
    setEyeRestFollowUp(true);
    setEyeRestPhase("prompt");
  }, []);

  // Preguntas auxiliares personalizadas: el facilitador redacta una pregunta que
  // se superpone al usuario, que responde Sí/No con la mirada. Se guardan aparte.
  const handleOpenCustomQuestion = useCallback(() => {
    setCustomQuestionPhase("compose");
  }, []);

  const handleShowCustomQuestion = useCallback((text: string) => {
    setCustomQuestionText(text);
    setCustomQuestionPhase("asking");
  }, []);

  const handleAnswerCustomQuestion = useCallback(
    (answer: "Sí" | "No") => {
      setAuxiliaryAnswers((previous) => [...previous, { question: customQuestionText, answer }]);
      setCustomQuestionPhase("idle");
      setCustomQuestionText("");
      resetDwell();
      setStatusMessage(`Pregunta auxiliar registrada: ${answer}.`);
    },
    [customQuestionText, resetDwell],
  );

  const handleCancelCustomQuestion = useCallback(() => {
    setCustomQuestionPhase("idle");
    setCustomQuestionText("");
    resetDwell();
  }, [resetDwell]);

  // Si se sale del modo de respuesta (pausa, ajustes, reinicio), se cierra
  // cualquier overlay pendiente (descanso o pregunta personalizada).
  useEffect(() => {
    if (formFlow.status !== "answering") {
      if (eyeRestPhase !== "idle") {
        setEyeRestPhase("idle");
        setEyeRestFollowUp(false);
        resetRestDwell();
      }
      if (customQuestionPhase !== "idle") {
        setCustomQuestionPhase("idle");
        setCustomQuestionText("");
      }
    }
  }, [customQuestionPhase, eyeRestPhase, formFlow.status, resetRestDwell]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!correctedPoint) {
      correctedPointWindowRef.current = [];
      oneEuroFilterRef.current?.x.reset();
      oneEuroFilterRef.current?.y.reset();
      setSmoothedPoint(null);
      return;
    }

    // Mediana móvil para descartar picos de un solo frame (frames atípicos por
    // pérdida momentánea de iris) antes del filtrado temporal.
    correctedPointWindowRef.current = [...correctedPointWindowRef.current, correctedPoint].slice(-5);
    const medianX = [...correctedPointWindowRef.current.map((point) => point.x)].sort((a, b) => a - b)[
      Math.floor(correctedPointWindowRef.current.length / 2)
    ];
    const medianY = [...correctedPointWindowRef.current.map((point) => point.y)].sort((a, b) => a - b)[
      Math.floor(correctedPointWindowRef.current.length / 2)
    ];

    // Filtro One-Euro: suaviza fuerte el temblor al fijar la mirada y casi no
    // añade retardo en movimientos reales. El ajuste de estabilización de la UI
    // controla cuánto suaviza en reposo.
    const options = oneEuroOptionsForStabilization(stabilization);
    if (!oneEuroFilterRef.current) {
      oneEuroFilterRef.current = {
        x: new OneEuroFilter(options),
        y: new OneEuroFilter(options),
      };
    } else {
      oneEuroFilterRef.current.x.setOptions(options);
      oneEuroFilterRef.current.y.setOptions(options);
    }

    const now = performance.now();
    setSmoothedPoint({
      x: oneEuroFilterRef.current.x.filter(medianX, now),
      y: oneEuroFilterRef.current.y.filter(medianY, now),
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
      setFormSubmissionId(null);
      setFormStartedAt(Date.now());
      dispatchFormFlow({ type: "loadForm", form: importedForm });
      dispatchFormFlow({ type: "openCalibrationChoice" });
      resetDwell();
      void prepareTtsForForm(importedForm);
      setStatusMessage(`Formulario importado: ${importedForm.title}.`);
      try {
        const updated = await saveForm({ form_id: importedForm.form_id, form_title: importedForm.title, form_url: trimmedUrl, provider: importedForm.provider });
        setSavedForms(updated);
      } catch {
        // don't fail import if saving fails
      }
    } catch {
      setImportError("No se pudo importar el formulario. Debe ser publico, de Google/Microsoft Forms y tener opciones multiples o casillas.");
      setStatusMessage("Importacion fallida.");
    } finally {
      setImportingForm(false);
    }
  }, [formUrl, resetDwell, prepareTtsForForm]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const forms = await getSavedForms();
        if (cancelled) return;
        setSavedForms(forms);
      } catch {
        // backend not available yet — ignore
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadSavedForm = useCallback(async (url: string) => {
    setFormUrl(url);
    setImportingForm(true);
    setImportError(null);
    setSubmitMessage(null);
    setStatusMessage("Cargando formulario guardado...");
    try {
      const importedForm = await importGoogleForm(url);
      setActiveFormUrl(url);
      setFormSubmissionId(null);
      setFormStartedAt(Date.now());
      dispatchFormFlow({ type: "loadForm", form: importedForm });
      dispatchFormFlow({ type: "openCalibrationChoice" });
      resetDwell();
      void prepareTtsForForm(importedForm);
      setStatusMessage(`Formulario cargado: ${importedForm.title}.`);
      try {
        const updated = await saveForm({ form_id: importedForm.form_id, form_title: importedForm.title, form_url: url, provider: importedForm.provider });
        setSavedForms(updated);
      } catch {
        // ignore
      }
    } catch {
      setImportError("No se pudo cargar el formulario guardado.");
      setStatusMessage("Carga fallida.");
    } finally {
      setImportingForm(false);
    }
  }, [resetDwell, prepareTtsForForm]);

  const handleDeleteSavedForm = useCallback(async (url: string) => {
    try {
      await deleteSavedForm(url);
      setSavedForms((prev) => prev.filter((f) => f.form_url !== url));
    } catch {
      // silently ignore
    }
  }, []);

  const handleSubmitForm = useCallback(async () => {
    if (!formFlow.form || !activeFormUrl) {
      return;
    }

    setSubmittingForm(true);
    setSubmitMessage(null);
    setStatusMessage("Enviando respuestas al formulario...");

    const durationSeconds = formStartedAt != null ? (Date.now() - formStartedAt) / 1000 : null;

    const payload: SubmitFormPayload = {
      ...(formSubmissionId ? { submission_id: formSubmissionId } : {}),
      url: activeFormUrl,
      submit_url: formFlow.form.submit_url,
      answers: formFlow.answers,
      form_id: formFlow.form.form_id,
      form_title: formFlow.form.title,
      provider: formFlow.form.provider,
      questions: formFlow.form.questions.map((q) => ({
        entry_id: q.entry_id,
        title: q.title,
        type: q.type,
      })),
      duration_seconds: durationSeconds,
      ...(auxiliaryAnswers.length > 0
        ? {
            auxiliary_answers: auxiliaryAnswers.map((aux) => ({
              question_title: aux.question,
              selected_options: [aux.answer],
            })),
          }
        : {}),
    };

    try {
      const response = await submitGoogleForm(payload);
      setFormSubmissionId(response.submission_id);
      setSubmitMessage(response.message);
      if (response.submitted) {
        dispatchFormFlow({ type: "markSubmitted" });
      }
      setStatusMessage(response.message);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Error desconocido";
      setSubmitMessage(`No se pudo enviar: ${detail}`);
      setStatusMessage("Envio fallido.");
    } finally {
      setSubmittingForm(false);
    }
  }, [activeFormUrl, auxiliaryAnswers, formFlow.answers, formFlow.form, formStartedAt, formSubmissionId]);

  const handleResetForm = useCallback(() => {
    dispatchFormFlow({ type: "reset" });
    setFormUrl("");
    setActiveFormUrl("");
    setFormSubmissionId(null);
    setImportError(null);
    setSubmitMessage(null);
    setAuxiliaryAnswers([]);
    setStatusMessage("Formulario reiniciado.");
    resetDwell();
  }, [resetDwell]);

  const handleStartCalibration = useCallback(() => {
    dispatchFormFlow({ type: "startCalibration" });
    setCalibrationInstructionsOpen(true);
    setCalibrationActive(false);
    setStatusMessage("Lee las instrucciones y pulsa Comenzar cuando estés listo.");
    resetDwell();
  }, [resetDwell]);

  const handleBeginCalibration = useCallback(() => {
    setCalibrationInstructionsOpen(false);
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
          `modelo final | muestras=${nextModel.sampleCount} score=${Math.round(nextModel.score * 100)}% (LOO) mezcla=${nextModel.blendWeight ?? "?"} rangoX=${
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
          dispatchFormFlow({ type: "completeCalibration" });
          setStatusMessage(
            "Calibracion completada con datos insuficientes. Repite el proceso con mejor iluminacion y manteniendo la cabeza estable.",
          );
          return;
        }

        dispatchFormFlow({ type: "completeCalibration" });
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        const preferences = profile.preferences;
        setProviderMode(preferences.provider_mode);
        setDwellMs(preferences.dwell_ms);
        setNeutralZonePercent(preferences.neutral_zone_percent);
        setStabilization(preferences.stabilization);
        setHorizontalSensitivity(preferences.horizontal_sensitivity);
        setVerticalSensitivity(preferences.vertical_sensitivity);
        setTheme(normalizeThemeName(preferences.theme));
        setUsePitchAssist(preferences.use_pitch_assist);
        setInvertVerticalAxis(preferences.invert_vertical_axis);
        setCameraOpacity(preferences.camera_opacity);
        setCameraVisible(preferences.camera_visible);
        setCenterPrecision(preferences.center_precision);
        setEyeRestEnabled(preferences.eye_rest_enabled);
        setEyeRestTriggerSeconds(preferences.eye_rest_trigger_seconds);
        setEyeRestPauseSeconds(preferences.eye_rest_pause_seconds);
        setTtsEnabled(preferences.tts_enabled);
        setTtsVoiceId(preferences.tts_voice_id);
        setTtsRate(preferences.tts_rate);
      } catch {
        if (!cancelled) {
          setPreferencesError(
            "No se pudo cargar la configuración guardada. Se están usando los valores predeterminados.",
          );
        }
      } finally {
        if (!cancelled) setPreferencesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preferences = useMemo<MiraLinkPreferences>(
    () => ({
      ...defaultMiraLinkPreferences,
      provider_mode: providerMode,
      dwell_ms: dwellMs,
      neutral_zone_percent: neutralZonePercent,
      stabilization,
      horizontal_sensitivity: horizontalSensitivity,
      vertical_sensitivity: verticalSensitivity,
      theme,
      high_contrast: themeOptions.find((option) => option.value === theme)?.highContrast ?? false,
      use_pitch_assist: usePitchAssist,
      invert_vertical_axis: invertVerticalAxis,
      camera_opacity: cameraOpacity,
      camera_visible: cameraVisible,
      center_precision: centerPrecision,
      eye_rest_enabled: eyeRestEnabled,
      eye_rest_trigger_seconds: eyeRestTriggerSeconds,
      eye_rest_pause_seconds: eyeRestPauseSeconds,
      tts_enabled: ttsEnabled,
      tts_voice_id: ttsVoiceId,
      tts_rate: ttsRate,
    }),
    [
      dwellMs,
      theme,
      horizontalSensitivity,
      invertVerticalAxis,
      neutralZonePercent,
      providerMode,
      stabilization,
      usePitchAssist,
      verticalSensitivity,
      cameraOpacity,
      cameraVisible,
      centerPrecision,
      eyeRestEnabled,
      eyeRestTriggerSeconds,
      eyeRestPauseSeconds,
      ttsEnabled,
      ttsVoiceId,
      ttsRate,
    ],
  );

  const handleSavePreferences = useCallback(async (next: MiraLinkPreferences) => {
    setSavingPreferences(true);
    setPreferencesError(null);
    setPreferencesSaved(false);
    try {
      const profile = await updateProfile(next);
      const saved = profile.preferences;
      setProviderMode(saved.provider_mode);
      setDwellMs(saved.dwell_ms);
      setNeutralZonePercent(saved.neutral_zone_percent);
      setStabilization(saved.stabilization);
      setHorizontalSensitivity(saved.horizontal_sensitivity);
      setVerticalSensitivity(saved.vertical_sensitivity);
      setTheme(normalizeThemeName(saved.theme));
      setUsePitchAssist(saved.use_pitch_assist);
      setInvertVerticalAxis(saved.invert_vertical_axis);
      setCameraOpacity(saved.camera_opacity);
      setCameraVisible(saved.camera_visible);
      setCenterPrecision(saved.center_precision);
      setEyeRestEnabled(saved.eye_rest_enabled);
      setEyeRestTriggerSeconds(saved.eye_rest_trigger_seconds);
      setEyeRestPauseSeconds(saved.eye_rest_pause_seconds);
      setTtsEnabled(saved.tts_enabled);
      setTtsVoiceId(saved.tts_voice_id);
      setTtsRate(saved.tts_rate);
      setPreferencesSaved(true);
      return true;
    } catch {
      setPreferencesError("No se pudo guardar la configuración.");
      return false;
    } finally {
      setSavingPreferences(false);
    }
  }, []);

  const answeredCount = Object.values(formFlow.answers).reduce((total, values) => total + values.length, 0);
  const compatibleQuestionCount = formFlow.form?.questions.length ?? 0;
  const binaryStepCount = formFlow.steps.length;
  const immersive = calibrationActive || calibrationInstructionsOpen || formFlow.status === "answering";
  const returnToAnswering =
    location.pathname === "/configuracion" &&
    Boolean((location.state as { returnToForm?: boolean } | null)?.returnToForm);

  const handleOpenSettingsFromAnswering = useCallback(() => {
    dispatchFormFlow({ type: "pauseAnswering" });
    resetDwell();
    navigate("/configuracion", { state: { returnToForm: true } });
  }, [navigate, resetDwell]);

  const handleReturnToAnswering = useCallback(() => {
    dispatchFormFlow({ type: "startAnswering" });
    resetDwell();
    navigate("/", { replace: true });
  }, [navigate, resetDwell]);

  const handleCancelCalibration = () => {
    setCalibrationActive(false);
    setCalibrationInstructionsOpen(false);
    setCalibrationProgress(0);
    dispatchFormFlow({ type: "skipCalibration" });
    setStatusMessage("Calibración cancelada. Puedes continuar sin calibrar o volver a intentarlo.");
  };

  const diagnostics = (
    <div className="diagnostics-grid">
      <section className="status-card gaze-preview-card">
        <h3>Previsualización de cámara</h3>
        <GazeOverlayPreview
          stream={camera.stream}
          sourceCanvasRef={overlayRef}
          className="camera-preview camera-preview--simple"
        />
        <p>
          {frame?.irisDetected
            ? `Iris detectados · confianza ${Math.round(frame.confidence * 100)}%`
            : "Esperando detección de iris"}
        </p>
      </section>
      <section className="status-card">
        <h3>Estado del seguimiento</h3>
        <ul>
          <li>{ready ? "Seguimiento listo" : "Inicializando proveedor"}</li>
          <li>Etapa: {stage}</li>
          <li>{error ?? camera.error ?? "Sin errores detectados"}</li>
          <li>{statusMessage}</li>
          <li>Preguntas compatibles: {compatibleQuestionCount}</li>
          <li>Pasos binarios: {binaryStepCount}</li>
          <li>Respuestas seleccionadas: {answeredCount}</li>
          <li>Score de calibración: {Math.round(calibrationScore * 100)}%</li>
          <li>Muestras de calibración: {calibrationModel.sampleCount}</li>
        </ul>
      </section>
      <section className="status-card status-card--debug">
        <h3>Logs del seguimiento ocular</h3>
        {combinedDebugLogs.length > 0 ? (
          <div className="debug-log-list">
            {combinedDebugLogs.map((entry) => (
              <code key={entry} className="debug-log-entry">
                {entry}
              </code>
            ))}
          </div>
        ) : (
          <p className="debug-log-empty">Aún no hay logs disponibles.</p>
        )}
      </section>
    </div>
  );

  return (
    <div
      className={`app-shell${immersive ? " app-shell--immersive" : ""}`}
    >
      {calibrationInstructionsOpen ? (
        <CalibrationInstructions
          totalPoints={calibrationSequence.length}
          onBegin={handleBeginCalibration}
          onCancel={handleCancelCalibration}
        />
      ) : null}

      {calibrationActive ? (
        <CalibrationOverlay
          activeIndex={calibrationIndex}
          activePointIndex={calibrationSequence[calibrationIndex]}
          total={calibrationSequence.length}
          progress={calibrationProgress}
          cameraBackdrop={
            cameraVisible && providerMode === "mediapipe" ? (
              <CalibrationCameraBackdrop
                stream={camera.stream}
                sourceCanvasRef={overlayRef}
                opacity={cameraOpacity}
              />
            ) : null
          }
          onCancel={handleCancelCalibration}
        />
      ) : null}

      {eyeRestPhase !== "idle" ? (
        <EyeRestOverlay
          phase={eyeRestPhase}
          gazePoint={actionablePoint}
          dwellMs={dwellMs}
          snapRadius={snapRadius}
          neutralZonePercent={neutralZonePercent}
          pauseSeconds={eyeRestPauseSeconds}
          followUp={eyeRestFollowUp}
          onAccept={handleEyeRestAccept}
          onDecline={handleEyeRestDecline}
          onPauseComplete={handleEyeRestPauseComplete}
        />
      ) : null}

      {customQuestionPhase !== "idle" ? (
        <CustomQuestionOverlay
          phase={customQuestionPhase}
          question={customQuestionText}
          gazePoint={actionablePoint}
          dwellMs={dwellMs}
          snapRadius={snapRadius}
          neutralZonePercent={neutralZonePercent}
          onShow={handleShowCustomQuestion}
          onAnswer={handleAnswerCustomQuestion}
          onCancel={handleCancelCustomQuestion}
        />
      ) : null}

      {!immersive ? <AppNavigation onHome={handleResetForm} /> : null}
      <div className="runtime-media-source" aria-hidden="true">
        <video ref={camera.videoRef} autoPlay muted playsInline />
        <canvas ref={overlayRef} />
      </div>

      <Routes>
        <Route
          path="/"
          element={
            formFlow.status === "answering" ? (
              <main className="answering-screen">
                <AnsweringToolbar
                  currentStep={Math.min(formFlow.currentStepIndex + 1, binaryStepCount)}
                  totalSteps={binaryStepCount}
                  trackingReady={ready}
                  onExit={() => dispatchFormFlow({ type: "pauseAnswering" })}
                  onOpenSettings={handleOpenSettingsFromAnswering}
                  onCustomQuestion={handleOpenCustomQuestion}
                />
                <BinaryFormPanel
                  form={formFlow.form}
                  step={activeStep}
                  answers={formFlow.answers}
                  status={formFlow.status}
                  focusedTargetId={focusedKeyId}
                  dwellProgress={dwellProgress}
                  restDwellProgress={eyeRestEnabled ? restDwellProgress : 0}
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
              </main>
            ) : (
              <main className="home-page page-container">
                {formFlow.status === "idle" ? (
                  <>
                    <section className="home-hero">
                      <div className="home-hero__copy">
                        <h1>Tu mirada. Tus respuestas.</h1>
                        <p>
                          MiraLink transforma formularios públicos en decisiones
                          accesibles de Sí o No, una opción cada vez.
                        </p>
                      </div>
                      <div className="eye-visual" aria-hidden="true">
                        <span className="eye-visual__orbit" />
                        <span className="eye-visual__iris" />
                        <span className="eye-visual__beam" />
                      </div>
                    </section>
                    <FormImportPanel
                      formUrl={formUrl}
                      importing={importingForm}
                      error={importError}
                      savedForms={savedForms}
                      onUrlChange={setFormUrl}
                      onImport={handleImportForm}
                      onLoadSaved={handleLoadSavedForm}
                      onDeleteSaved={handleDeleteSavedForm}
                    />
                  </>
                ) : null}

                {formFlow.status === "calibrationChoice" ? (
                  <section className="flow-card">
                    <p className="flow-step">Formulario cargado</p>
                    <h1>{formFlow.form?.title}</h1>
                    <p>
                      Puedes calibrar la mirada para mejorar la precisión o usar el
                      mapeo predeterminado.
                    </p>
                    <div className="choice-grid">
                      <button type="button" className="choice-card" onClick={handleStartCalibration}>
                        <strong>Iniciar calibración</strong>
                        <span>Nueve puntos para adaptar el seguimiento a tu mirada.</span>
                      </button>
                      <button
                        type="button"
                        className="choice-card"
                        onClick={() => dispatchFormFlow({ type: "skipCalibration" })}
                      >
                        <strong>Continuar sin calibrar</strong>
                        <span>Usar la detección ocular predeterminada.</span>
                      </button>
                    </div>
                  </section>
                ) : null}

                {formFlow.status === "ready" ? (
                  <section className="flow-card flow-card--ready">
                    <p className="flow-step">Todo preparado</p>
                    <h1>{formFlow.form?.title}</h1>
                    <p>
                      {calibrationModel.sampleCount >= 4
                        ? `Calibración completada con una precisión estimada del ${Math.round(calibrationScore * 100)}%.`
                        : "Se utilizará el seguimiento ocular sin calibración personalizada."}
                    </p>
                    {calibrationModel.sampleCount < 4 ? (
                      <button type="button" className="secondary-button" onClick={handleStartCalibration}>
                        Reintentar calibración
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => dispatchFormFlow({ type: "startAnswering" })}
                    >
                      {formFlow.currentStepIndex > 0 ? "Continuar formulario" : "Empezar formulario"}
                    </button>
                  </section>
                ) : null}

                {formFlow.status === "review" || formFlow.status === "submitted" ? (
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
                ) : null}
              </main>
            )
          }
        />
        <Route
          path="/configuracion"
          element={
            preferencesReady ? (
              <SettingsPage
                preferences={preferences}
                saving={savingPreferences}
                error={preferencesError}
                saved={preferencesSaved}
                diagnostics={diagnostics}
                ttsVoices={ttsVoices.voices}
                ttsBrowserSupported={ttsVoices.browserSupported}
                onSave={handleSavePreferences}
                onReturnToForm={returnToAnswering ? handleReturnToAnswering : undefined}
              />
            ) : (
              <main className="page-container loading-page">Cargando configuración...</main>
            )
          }
        />
        <Route
          path="/administracion"
          element={
            <main className="admin-page page-container">
              <AdminPanel onClose={() => navigate("/")} />
            </main>
          }
        />
        <Route path="*" element={<main className="page-container">Página no encontrada.</main>} />
      </Routes>

      {displayPoint && immersive && eyeRestPhase !== "resting" ? (
        <div className="gaze-cursor" style={{ left: `${displayPoint.x}px`, top: `${displayPoint.y}px` }}>
          <span className="gaze-cursor__ring" />
          <span className="gaze-cursor__dot" />
        </div>
      ) : null}
    </div>
  );
}
