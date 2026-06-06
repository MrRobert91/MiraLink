import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ProviderMode } from "../lib/gazeProvider";
import { MediapipeBrowserProvider } from "../lib/mediapipeBrowserProvider";
import { PointerProvider } from "../lib/pointerProvider";
import type { GazeFrame, GazeProviderStatus, RawGazeMappingOptions } from "../types";

type UseGazeProviderOptions = {
  mode: ProviderMode;
  enabled: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  mappingOptions?: Partial<RawGazeMappingOptions>;
};

type GazeProviderState = {
  frame: GazeFrame | null;
  ready: boolean;
  providerLabel: string;
  error: string | null;
  stage: GazeProviderStatus;
  debugLogs: string[];
};

export function useGazeProvider({
  mode,
  enabled,
  videoRef,
  overlayRef,
  mappingOptions,
}: UseGazeProviderOptions): GazeProviderState {
  const [frame, setFrame] = useState<GazeFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<GazeProviderStatus>("idle");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const providerRef = useRef<MediapipeBrowserProvider | PointerProvider | null>(null);
  const logBufferRef = useRef<string[]>([]);
  const mappingOptionsRef = useRef<Partial<RawGazeMappingOptions> | undefined>(mappingOptions);

  const providerLabel = useMemo(() => {
    switch (mode) {
      case "pointer":
        return "Modo puntero";
      default:
        return "MediaPipe + webcam";
    }
  }, [mode]);

  useEffect(() => {
    mappingOptionsRef.current = mappingOptions;
  }, [mappingOptions]);

  useEffect(() => {
    setFrame(null);
    setError(null);
    setStage(enabled ? "loading" : "idle");
    logBufferRef.current = [];

    if (!enabled) {
      return;
    }

    const pushLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString("es-ES", { hour12: false });
      const entry = `${timestamp} | ${message}`;
      console.info(`[GazeProvider] ${entry}`);
      logBufferRef.current = [...logBufferRef.current, entry].slice(-30);
      setDebugLogs(logBufferRef.current);
    };

    let mounted = true;

    void (async () => {
      try {
        pushLog(`modo=${mode}`);
        let provider: MediapipeBrowserProvider | PointerProvider;

        if (mode === "pointer") {
          provider = new PointerProvider({
            onFrame: (nextFrame) => {
              if (!mounted) {
                return;
              }
              setFrame(nextFrame);
            },
          });
        } else {
          const videoElement = videoRef.current;
          if (!videoElement) {
            throw new Error("La webcam no está lista todavía.");
          }
          provider = new MediapipeBrowserProvider({
            videoElement,
            overlayElement: overlayRef.current,
            getViewportSize: () => ({
              width: window.innerWidth,
              height: window.innerHeight,
            }),
            getMappingOptions: () => mappingOptionsRef.current ?? {},
            onFrame: (nextFrame) => {
              if (!mounted) {
                return;
              }
              setFrame(nextFrame);
              setStage(nextFrame.irisDetected ? "ready" : nextFrame.faceDetected ? "degraded" : "tracking");
            },
            onDebug: pushLog,
          });
        }

        providerRef.current = provider;
        await provider.init();
        if (!mounted) {
          return;
        }

        setStage(provider.getStatus());
        await provider.start();
        if (!mounted) {
          return;
        }

        setStage(provider.getStatus());
        pushLog("proveedor arrancado");
      } catch (reason) {
        if (!mounted) {
          return;
        }
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStage("failed");
        pushLog(`error=${message}`);
      }
    })();

    return () => {
      mounted = false;
      const provider = providerRef.current;
      providerRef.current = null;
      if (provider) {
        void provider.stop();
      }
    };
  }, [enabled, mode, overlayRef, videoRef]);

  return {
    frame,
    ready: stage === "ready" || stage === "degraded" || stage === "tracking",
    providerLabel,
    error,
    stage,
    debugLogs,
  };
}
