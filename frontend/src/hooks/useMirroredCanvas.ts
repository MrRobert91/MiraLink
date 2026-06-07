import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type MirroredCanvasRefs = {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
};

/**
 * Conecta un `<video>` al stream de la webcam y copia, en cada frame, el canvas
 * off-screen donde el proveedor de MediaPipe dibuja la malla/keypoints a un
 * canvas visible. Lo usan la previsualización de diagnóstico y el fondo de
 * calibración, que compartían esta misma lógica.
 *
 * El espejado horizontal (vista selfie) se aplica por CSS sobre el `<video>`;
 * el canvas conserva el espejado que ya hace el dibujo en JS.
 */
export function useMirroredCanvas(
  stream: MediaStream | null,
  sourceCanvasRef: RefObject<HTMLCanvasElement | null>,
): MirroredCanvasRefs {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return { videoRef, canvasRef };
}
