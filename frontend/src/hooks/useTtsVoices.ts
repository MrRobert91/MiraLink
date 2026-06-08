import { useEffect, useState } from "react";

import { fetchBackendVoices } from "../lib/api";
import type { Voice } from "../types";

type TtsVoicesState = {
  /** Catálogo de voces de backend (Piper/Kokoro). */
  voices: Voice[];
};

/**
 * Reúne el catálogo de voces para el selector de Ajustes. Las voces provienen
 * del catálogo del API (vacío si no hay modelos instalados).
 */
export function useTtsVoices(): TtsVoicesState {
  const [backendVoices, setBackendVoices] = useState<Voice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const voices = await fetchBackendVoices();
        if (!cancelled) setBackendVoices(voices);
      } catch {
        if (!cancelled) setBackendVoices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    voices: backendVoices,
  };
}
