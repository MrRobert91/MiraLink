/**
 * Voz por defecto cuando no se ha seleccionado ninguna ("" = Automática).
 * Debe coincidir con la voz por defecto de `DEFAULT_PIPER_VOICES` en
 * `backend/app/services/tts/piper.py`.
 */
export const DEFAULT_VOICE_ID = "piper:es_ES-davefx-medium";

/** Motor codificado en un id de voz cualificado ("engine:local"). */
export function voiceEngine(voiceId: string): string {
  const [engine] = voiceId.split(":", 1);
  return engine;
}

/** Resuelve el id de voz efectivo: vacío ("Automática") → voz por defecto. */
export function resolveVoiceId(voiceId: string): string {
  return voiceId || DEFAULT_VOICE_ID;
}
