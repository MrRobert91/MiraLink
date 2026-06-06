import { useEffect, type ReactNode } from "react";

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
  useEffect(() => {
    if (!onCancel) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

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

      <p className="sr-only" aria-live="polite">
        Punto {activeIndex + 1} de {total}. Mira fijo hasta que avance.
      </p>

      {onCancel ? (
        <button
          type="button"
          className="calibration-overlay__cancel"
          onClick={onCancel}
          aria-label="Cancelar calibración (Escape)"
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}
