type PauseOverlayProps = {
  onResume: () => void;
};

/**
 * Pantalla de pausa manual. Se controla solo con ratón (no con la mirada): el
 * formulario se detiene hasta que se pulsa "Reanudar".
 */
export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Formulario en pausa">
      <div className="pause-overlay__card">
        <p className="pause-overlay__label">En pausa</p>
        <p className="pause-overlay__hint">
          El formulario está detenido. Tus respuestas se conservan.
        </p>
        <button type="button" className="primary-button" onClick={onResume}>
          Reanudar
        </button>
      </div>
    </div>
  );
}
