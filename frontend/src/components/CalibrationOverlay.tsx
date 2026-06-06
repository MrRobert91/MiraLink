import type { ReactNode } from "react";

import { calibrationPointPercentages } from "../lib/calibration";

type CalibrationOverlayProps = {
  activeIndex: number;
  activePointIndex?: number;
  total: number;
  progress: number;
  cameraBackdrop?: ReactNode;
  onCancel?: () => void;
};

export function CalibrationOverlay({
  activeIndex,
  activePointIndex = activeIndex,
  total,
  progress,
  cameraBackdrop,
  onCancel,
}: CalibrationOverlayProps) {
  return (
    <div className="calibration-overlay" aria-label="Calibracion">
      {cameraBackdrop}

      {calibrationPointPercentages.map((point, index) => {
        const isActive = index === activePointIndex;
        return (
          <div
            key={`${point.x}-${point.y}`}
            className={`calibration-point${isActive ? " calibration-point--active" : ""}`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`Punto de calibracion ${index + 1}`}
          >
            {isActive ? (
              <span
                className="calibration-point__progress"
                style={{
                  background: `conic-gradient(var(--accent) ${progress * 360}deg, transparent 0deg)`,
                }}
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}

      <div className="calibration-overlay__footer">
        <p className="calibration-overlay__counter" aria-live="polite">
          Punto {activeIndex + 1} de {total} · mira fijo hasta que avance
        </p>
        {onCancel ? (
          <button type="button" className="text-button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
