import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type GazeOverlayPreviewProps = {
  stream: MediaStream | null;
  sourceCanvasRef: RefObject<HTMLCanvasElement | null>;
  className?: string;
};

/**
 * Shows the live webcam with the face mesh + iris keypoints on top.
 *
 * The MediaPipe provider draws the keypoints into an off-screen canvas
 * (`sourceCanvasRef`). Here we mirror that canvas onto a visible one each
 * animation frame so the diagnostics view can display the overlay without
 * fighting the provider for the source canvas ref.
 */
export function GazeOverlayPreview({ stream, sourceCanvasRef, className = "" }: GazeOverlayPreviewProps) {
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
    <div className={className}>
      <video ref={videoRef} autoPlay muted playsInline />
      <canvas ref={canvasRef} className="camera-preview__overlay" />
      {!stream ? <span>Esperando cámara...</span> : null}
    </div>
  );
}
