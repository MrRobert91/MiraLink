import { useCallback, useEffect, useRef, useState } from "react";

type UseSpeechOptions = {
  rate: number;
  /** URL de audio ya preparada para un texto, o null si aún no está disponible. */
  getAudioUrl?: (text: string) => string | null;
  /** Se invoca solo cuando la locución termina de forma natural (no al cancelar). */
  onEnd?: () => void;
};

/**
 * Lectura en voz alta basada en audio de backend (Piper). Expone una API única
 * (`speak`/`cancel`/`isSpeaking`) de modo que el resto de la app no necesita
 * saber cómo se genera el audio. `isSpeaking` se mantiene uniforme para que el
 * bloqueo de dwell funcione igual.
 *
 * Si no hay audio disponible (sin preparar o fallo de reproducción) no se lee
 * nada: se libera el bloqueo y se dispara `onEnd` para que el flujo avance
 * (silencio + aviso visual), sin recurrir a la voz del navegador.
 */
export function useSpeech({ rate, getAudioUrl, onEnd }: UseSpeechOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ref para no recrear `speak` cada vez que cambia el callback.
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const finishNaturally = useCallback(() => {
    setIsSpeaking(false);
    onEndRef.current?.();
  }, []);

  const cancel = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    /**
     * `audioUrlOverride` permite reproducir un audio recién preparado sin esperar
     * a que `getAudioUrl` (derivado de estado) se actualice: evita una condición
     * de carrera al locutar textos generados al vuelo (calibración, descanso,
     * pregunta personalizada).
     */
    (text: string, audioUrlOverride?: string | null) => {
      cancel();
      if (!text.trim()) {
        return;
      }
      const url = audioUrlOverride ?? getAudioUrl?.(text) ?? null;
      if (!url) {
        // Sin audio preparado: no se lee. Se libera el bloqueo y avanza el flujo.
        finishNaturally();
        return;
      }
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audioRef.current = audio;
      audio.onended = () => finishNaturally();
      audio.onerror = () => {
        // Fallo de carga del audio: tratamos como fin natural (silencio).
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        finishNaturally();
      };
      // Bloquea el dwell ya, antes de que el audio empiece a sonar.
      setIsSpeaking(true);
      void audio.play().catch(() => {
        // Si el audio no puede reproducirse, no recurrimos al navegador: silencio.
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        finishNaturally();
      });
    },
    [rate, getAudioUrl, cancel, finishNaturally],
  );

  // Cancela cualquier locución pendiente al desmontar.
  useEffect(() => cancel, [cancel]);

  return {
    speak,
    cancel,
    isSpeaking,
  };
}
