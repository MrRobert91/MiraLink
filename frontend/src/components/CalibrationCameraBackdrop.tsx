import type { RefObject } from "react";

import { useMirroredCanvas } from "../hooks/useMirroredCanvas";

type CalibrationCameraBackdropProps = {
  stream: MediaStream | null;
  sourceCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Opacidad de la cámara en porcentaje (0-100). */
  opacity: number;
};

/**
 * Fondo de cámara a pantalla completa y translúcido para la calibración.
 *
 * Muestra el vídeo de la webcam cubriendo toda la pantalla con la malla
 * facial y los keypoints de los iris superpuestos. La malla se dibuja en un
 * canvas off-screen (`sourceCanvasRef`) por el proveedor de MediaPipe; aquí lo
 * espejamos a un canvas visible cada frame mediante `useMirroredCanvas`, igual
 * que en la previsualización de diagnóstico.
 */
export function CalibrationCameraBackdrop({
  stream,
  sourceCanvasRef,
  opacity,
}: CalibrationCameraBackdropProps) {
  const { videoRef, canvasRef } = useMirroredCanvas(stream, sourceCanvasRef);

  return (
    <div
      className="calibration-camera-backdrop"
      style={{ opacity: Math.min(Math.max(opacity, 0), 100) / 100 }}
      aria-hidden="true"
    >
      <video ref={videoRef} autoPlay muted playsInline />
      <canvas ref={canvasRef} />
    </div>
  );
}
