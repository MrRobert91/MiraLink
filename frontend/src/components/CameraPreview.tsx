import { useEffect, useRef } from "react";

type CameraPreviewProps = {
  stream: MediaStream | null;
  className?: string;
};

export function CameraPreview({ stream, className = "" }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play();
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className={className}>
      <video ref={videoRef} autoPlay muted playsInline />
      {!stream ? <span>Esperando cámara...</span> : null}
    </div>
  );
}
