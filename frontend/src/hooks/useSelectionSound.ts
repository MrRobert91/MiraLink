import { useCallback, useEffect, useMemo, useRef } from "react";

import { getSelectionSoundSrc } from "../lib/selectionSounds";

type UseSelectionSoundOptions = {
  enabled: boolean;
  /** Id del sonido para "Sí" (vacío = ninguno). */
  yesSoundId: string;
  /** Id del sonido para "No" (vacío = ninguno). */
  noSoundId: string;
};

/**
 * Feedback sonoro de la selección. Precarga los audios elegidos y expone
 * `playYes`/`playNo`. Reutiliza el patrón `new Audio(url)` de useSpeech, pero
 * clona el elemento en cada reproducción para permitir disparos solapados.
 */
export function useSelectionSound({ enabled, yesSoundId, noSoundId }: UseSelectionSoundOptions) {
  const yesSrc = enabled ? getSelectionSoundSrc(yesSoundId) : null;
  const noSrc = enabled ? getSelectionSoundSrc(noSoundId) : null;

  const yesAudioRef = useRef<HTMLAudioElement | null>(null);
  const noAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    yesAudioRef.current = yesSrc ? new Audio(yesSrc) : null;
  }, [yesSrc]);

  useEffect(() => {
    noAudioRef.current = noSrc ? new Audio(noSrc) : null;
  }, [noSrc]);

  const play = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) {
      return;
    }
    // Clonar permite reproducir aunque el sonido anterior siga sonando.
    const instance = audio.cloneNode() as HTMLAudioElement;
    void instance.play().catch(() => {
      // Reproducción bloqueada por el navegador o sonido no disponible: ignorar.
    });
  }, []);

  const playYes = useCallback(() => play(yesAudioRef.current), [play]);
  const playNo = useCallback(() => play(noAudioRef.current), [play]);

  return useMemo(() => ({ playYes, playNo }), [playYes, playNo]);
}
