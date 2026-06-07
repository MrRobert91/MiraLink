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

  // En el navegador, `Audio.play()` queda bloqueado hasta que el usuario
  // interactúa con la página. Como la selección es por mirada (sin clic), los
  // sonidos nunca llegarían a sonar. Al primer gesto real "cebamos" los audios
  // (play→pause) para habilitar futuras reproducciones disparadas por la mirada.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let unlocked = false;
    const unlock = () => {
      if (unlocked) {
        return;
      }
      unlocked = true;
      for (const audio of [yesAudioRef.current, noAudioRef.current]) {
        if (!audio) {
          continue;
        }
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {
            // Si aún no se permite reproducir, se reintentará en el próximo gesto.
            unlocked = false;
          });
      }
      if (unlocked) {
        removeListeners();
      }
    };
    const removeListeners = () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return removeListeners;
  }, [enabled, yesSrc, noSrc]);

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
