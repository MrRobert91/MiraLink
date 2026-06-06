import { useEffect, useRef, useState } from "react";

type UseCameraStreamOptions = {
  enabled: boolean;
};

export function useCameraStream({ enabled }: UseCameraStreamOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      setStream(null);
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    void (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;
        setStream(mediaStream);
        const videoElement = videoRef.current;
        if (!videoElement) {
          setError("No se pudo inicializar el elemento de video.");
          return;
        }

        videoElement.srcObject = mediaStream;
        await videoElement.play();
        setReady(true);
        setError(null);
      } catch (reason) {
        setReady(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      setStream(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [enabled]);

  return {
    videoRef,
    stream,
    ready,
    error,
  };
}
