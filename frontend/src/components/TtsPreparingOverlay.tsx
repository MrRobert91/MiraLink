type TtsPreparingOverlayProps = {
  /** Audios ya generados. */
  done: number;
  /** Total de audios a generar. */
  total: number;
};

/**
 * Pantalla de bloqueo mientras se pre-generan los audios del formulario (voz
 * Piper). Aparece solo si el usuario pulsa "Empezar formulario" antes de que la
 * generación anticipada haya terminado, para que las pantallas explicativas y la
 * lectura suenen de inmediato al empezar a responder.
 */
export function TtsPreparingOverlay({ done, total }: TtsPreparingOverlayProps) {
  const progress = total > 0 ? Math.min(done / total, 1) : 0;
  return (
    <div
      className="tts-preparing-overlay"
      role="status"
      aria-live="polite"
      aria-label="Preparando audios"
    >
      <div className="tts-preparing">
        <p className="tts-preparing__label">Preparando audios…</p>
        <div className="tts-preparing__bar" aria-hidden="true">
          <span className="tts-preparing__bar-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="tts-preparing__count">
          {total > 0 ? `${Math.min(done, total)} / ${total}` : "Generando voz…"}
        </p>
        <p className="tts-preparing__hint">
          Se generan una sola vez; la próxima vez con este formulario será inmediato.
        </p>
      </div>
    </div>
  );
}
