import { useState, type ReactNode } from "react";

import { calibrationPointPercentages } from "../lib/calibration";

type CalibrationOverlayProps = {
  activeIndex: number;
  activePointIndex?: number;
  total: number;
  progress: number;
  cameraPreview?: ReactNode;
  onCancel?: () => void;
};

export function CalibrationOverlay({
  activeIndex,
  activePointIndex = activeIndex,
  total,
  progress,
  cameraPreview,
  onCancel,
}: CalibrationOverlayProps) {
  const [showCamera, setShowCamera] = useState(true);
  const remainingSeconds = Math.max(0, 5 - progress * 5);

  return (
    <div className="calibration-overlay" aria-label="Calibracion">
      <div className="calibration-copy">
        <p className="flow-step">Calibración</p>
        <p>
          Punto {activeIndex + 1} de {total}. Mantén la mirada fija sobre el
          punto activo. El avance es automático.
        </p>
        <p className="calibration-copy__hint">
          Revisa la previsualizacion de la webcam: tu cara debe verse centrada y la malla y la caja deben seguirla.
        </p>
        <p className="calibration-copy__meta">Tiempo restante: {remainingSeconds.toFixed(1)} s</p>
        <div className="calibration-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="calibration-actions">
          {cameraPreview ? (
            <button
              type="button"
              className="text-button"
              onClick={() => setShowCamera((current) => !current)}
            >
              {showCamera ? "Ocultar cámara" : "Mostrar cámara"}
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" className="text-button" onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
      {cameraPreview && showCamera ? cameraPreview : null}
      {calibrationPointPercentages.map((point, index) => (
        <div
          key={`${point.x}-${point.y}`}
          className={`calibration-point${index === activePointIndex ? " calibration-point--active" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          aria-label={`Punto de calibracion ${index + 1}`}
        />
      ))}
    </div>
  );
}
