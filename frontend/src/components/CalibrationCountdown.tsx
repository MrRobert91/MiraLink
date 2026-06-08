import type { ReactNode } from "react";

type CalibrationCountdownProps = {
  /** Número grande que se muestra (3, 2, 1). */
  value: number;
  /** Fondo opcional con la cámara, igual que en la calibración. */
  cameraBackdrop?: ReactNode;
};

/**
 * Cuenta atrás solo visual antes de que aparezcan los puntos de calibración. Da
 * un margen al usuario para fijar la mirada tras pulsar "Comenzar".
 */
export function CalibrationCountdown({ value, cameraBackdrop }: CalibrationCountdownProps) {
  return (
    <div className="calibration-countdown" role="status" aria-live="polite">
      {cameraBackdrop ? (
        <div className="calibration-countdown__backdrop">{cameraBackdrop}</div>
      ) : null}
      <div className="calibration-countdown__content">
        <p className="calibration-countdown__label">Preparándose</p>
        <p className="calibration-countdown__value">{value}</p>
        <p className="calibration-countdown__hint">Mantén la mirada al frente.</p>
      </div>
    </div>
  );
}
