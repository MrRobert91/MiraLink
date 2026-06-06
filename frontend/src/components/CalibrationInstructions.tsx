type CalibrationInstructionsProps = {
  totalPoints: number;
  onBegin: () => void;
  onCancel: () => void;
};

/**
 * Pantalla previa a la calibración: explica el proceso con claridad antes de
 * que aparezcan los puntos. El usuario inicia con un botón "Comenzar".
 */
export function CalibrationInstructions({
  totalPoints,
  onBegin,
  onCancel,
}: CalibrationInstructionsProps) {
  return (
    <div className="calibration-instructions" aria-label="Instrucciones de calibración">
      <section className="calibration-instructions__card">
        <p className="flow-step">Antes de empezar</p>
        <h1>Cómo funciona la calibración</h1>
        <p className="calibration-instructions__lead">
          Vamos a ajustar el seguimiento a tu mirada. Aparecerán {totalPoints} puntos
          de uno en uno por la pantalla. El proceso dura aproximadamente un minuto.
        </p>
        <ol className="calibration-instructions__steps">
          <li>
            <strong>Colócate cómodo</strong> frente a la cámara, con la cara bien
            iluminada y centrada en la imagen.
          </li>
          <li>
            <strong>Mantén la cabeza quieta</strong> durante todo el proceso; mueve
            solo los ojos.
          </li>
          <li>
            <strong>Mira fijamente cada punto</strong> que se ilumine hasta que se
            complete y avance solo al siguiente.
          </li>
          <li>
            <strong>Evita parpadear de más</strong> mientras un punto está activo.
          </li>
        </ol>
        <p className="calibration-instructions__hint">
          Verás tu cámara de fondo con la malla facial para confirmar que se te
          detecta bien. Puedes ajustar su transparencia o desactivarla en
          Configuración.
        </p>
        <div className="calibration-instructions__actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="primary-button" onClick={onBegin}>
            Comenzar
          </button>
        </div>
      </section>
    </div>
  );
}
