import type { RefObject } from "react";

import { useMirroredCanvas } from "../hooks/useMirroredCanvas";

type GazeOverlayPreviewProps = {
  stream: MediaStream | null;
  sourceCanvasRef: RefObject<HTMLCanvasElement | null>;
  className?: string;
};

/**
 * Shows the live webcam with the face mesh + iris keypoints on top.
 *
 * The MediaPipe provider draws the keypoints into an off-screen canvas
 * (`sourceCanvasRef`). `useMirroredCanvas` mirrors that canvas onto a visible
 * one each animation frame so the diagnostics view can display the overlay
 * without fighting the provider for the source canvas ref.
 */
export function GazeOverlayPreview({ stream, sourceCanvasRef, className = "" }: GazeOverlayPreviewProps) {
  const { videoRef, canvasRef } = useMirroredCanvas(stream, sourceCanvasRef);

  return (
    <div className={className}>
      <video ref={videoRef} autoPlay muted playsInline />
      <canvas ref={canvasRef} className="camera-preview__overlay" />
      {!stream ? <span>Esperando cámara...</span> : null}
    </div>
  );
}
