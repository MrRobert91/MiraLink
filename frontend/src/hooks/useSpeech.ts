import { useCallback, useEffect, useRef, useState } from "react";

import {
  BROWSER_ENGINE,
  findBrowserVoice,
  isSpeechSynthesisSupported,
  voiceEngine,
} from "../lib/speech";

type UseSpeechOptions = {
  /** Id de voz seleccionado: "" (auto), "browser:<nombre>" o "<engine>:<id>". */
  voiceId: string;
  rate: number;
  /** Para voces de backend: URL de audio ya preparada para un texto, o null. */
  getAudioUrl?: (text: string) => string | null;
  /** Se invoca solo cuando la locución termina de forma natural (no al cancelar). */
  onEnd?: () => void;
};

/**
 * Lectura en voz alta unificada sobre dos motores. Expone una única API
 * (`speak`/`cancel`/`isSpeaking`) de modo que el resto de la app no necesita
 * saber si la voz es del navegador (SpeechSynthesis) o de backend (audio
 * cacheado). `isSpeaking` es uniforme: así el bloqueo de dwell funciona igual.
 */
export function useSpeech({ voiceId, rate, getAudioUrl, onEnd }: UseSpeechOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ref para no recrear `speak`/`speakBrowser` cada vez que cambia el callback.
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const finishNaturally = useCallback(() => {
    setIsSpeaking(false);
    onEndRef.current?.();
  }, []);

  const cancel = useCallback(() => {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speakBrowser = useCallback(
    (text: string): boolean => {
      if (!isSpeechSynthesisSupported()) {
        return false;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = findBrowserVoice(voiceId);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "es-ES";
      }
      utterance.rate = rate;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => finishNaturally();
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [voiceId, rate, finishNaturally],
  );

  const speak = useCallback(
    (text: string) => {
      cancel();
      if (!text.trim()) {
        return;
      }
      const engine = voiceId ? voiceEngine(voiceId) : BROWSER_ENGINE;

      if (engine !== BROWSER_ENGINE) {
        const url = getAudioUrl?.(text) ?? null;
        if (url) {
          const audio = new Audio(url);
          audio.playbackRate = rate;
          audioRef.current = audio;
          audio.onended = () => finishNaturally();
          audio.onerror = () => setIsSpeaking(false);
          // Bloquea el dwell ya, antes de que el audio empiece a sonar.
          setIsSpeaking(true);
          void audio.play().catch(() => {
            // Si el audio de backend no puede reproducirse, recurre al navegador.
            if (audioRef.current === audio) {
              audioRef.current = null;
            }
            if (!speakBrowser(text)) {
              setIsSpeaking(false);
            }
          });
          return;
        }
        // Sin audio preparado para este texto: cae a la voz del navegador.
      }

      if (!speakBrowser(text)) {
        setIsSpeaking(false);
      }
    },
    [voiceId, rate, getAudioUrl, cancel, speakBrowser, finishNaturally],
  );

  // Cancela cualquier locución pendiente al desmontar.
  useEffect(() => cancel, [cancel]);

  return {
    speak,
    cancel,
    isSpeaking,
    supported: isSpeechSynthesisSupported(),
  };
}
