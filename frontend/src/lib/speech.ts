import type { Voice } from "../types";

export const BROWSER_ENGINE = "browser";

/** Prefijo de id para las voces del navegador: "browser:<nombre>". */
export function browserVoiceId(name: string): string {
  return `${BROWSER_ENGINE}:${name}`;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Motor codificado en un id de voz cualificado ("engine:local"). */
export function voiceEngine(voiceId: string): string {
  const [engine] = voiceId.split(":", 1);
  return engine;
}

function isSpanish(lang: string): boolean {
  return lang.toLowerCase().startsWith("es");
}

/** Voces nativas del navegador mapeadas al tipo `Voice` (español primero). */
export function listBrowserVoices(): Voice[] {
  if (!isSpeechSynthesisSupported()) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  return voices
    .map<Voice>((voice) => ({
      id: browserVoiceId(voice.name),
      label: `${voice.name} (${voice.lang})`,
      engine: BROWSER_ENGINE,
      lang: voice.lang,
    }))
    .sort((a, b) => Number(isSpanish(b.lang)) - Number(isSpanish(a.lang)));
}

/**
 * Resuelve el `SpeechSynthesisVoice` real para un id seleccionado. Con id vacío
 * (automática) elige la primera voz en español disponible.
 */
export function findBrowserVoice(voiceId: string): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }
  if (voiceId && voiceEngine(voiceId) === BROWSER_ENGINE) {
    const name = voiceId.slice(BROWSER_ENGINE.length + 1);
    const match = voices.find((voice) => voice.name === name);
    if (match) {
      return match;
    }
  }
  return voices.find((voice) => isSpanish(voice.lang)) ?? voices[0];
}
