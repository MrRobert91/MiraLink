import { useEffect, useState } from "react";

import { fetchBackendVoices } from "../lib/api";
import { isSpeechSynthesisSupported, listBrowserVoices } from "../lib/speech";
import type { Voice } from "../types";

type TtsVoicesState = {
  /** Catálogo combinado: voces del navegador + voces de backend. */
  voices: Voice[];
  /** Falso si el navegador no expone ninguna voz (kiosco sin TTS). */
  browserSupported: boolean;
};

/**
 * Reúne el catálogo de voces para el selector de Ajustes. Las del navegador se
 * descubren en runtime (y se recargan al disparar `voiceschanged`); las de
 * backend llegan del catálogo del API (vacío si no hay modelos instalados).
 */
export function useTtsVoices(): TtsVoicesState {
  const [browserVoices, setBrowserVoices] = useState<Voice[]>(() => listBrowserVoices());
  const [backendVoices, setBackendVoices] = useState<Voice[]>([]);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      return;
    }
    const refresh = () => setBrowserVoices(listBrowserVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

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
    voices: [...browserVoices, ...backendVoices],
    browserSupported: browserVoices.length > 0,
  };
}
