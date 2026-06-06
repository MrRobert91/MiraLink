import { useEffect, useRef } from "react";
import type { RefObject } from "react";

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
 * espejamos a un canvas visible cada frame, igual que en la previsualización
 * de diagnóstico.
 */
export function CalibrationCameraBackdrop({
  stream,
  sourceCanvasRef,
  opacity,
}: CalibrationCameraBackdropProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play();
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    let frameId = 0;

    const copyFrame = () => {
      const destination = canvasRef.current;
      const source = sourceCanvasRef.current;
      if (destination && source && source.width > 0 && source.height > 0) {
        if (destination.width !== source.width || destination.height !== source.height) {
          destination.width = source.width;
          destination.height = source.height;
        }
        const context = destination.getContext("2d");
        if (context) {
          context.clearRect(0, 0, destination.width, destination.height);
          context.drawImage(source, 0, 0);
        }
      }
      frameId = window.requestAnimationFrame(copyFrame);
    };

    frameId = window.requestAnimationFrame(copyFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [sourceCanvasRef]);

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
