import { useEffect, useState } from "react";

type ReadyPulseProps = {
  /**
   * Contador que se incrementa cada vez que se debe disparar el pulso (al
   * desbloquearse la lectura o al terminar la locución de una pregunta). El
   * valor 0 no dispara nada (estado inicial).
   */
  trigger: number;
};

/**
 * Destello a pantalla completa del color del tema (`--accent`) que indica que
 * ya se puede responder. Se monta brevemente al cambiar `trigger` y se desmonta
 * solo al terminar la animación.
 */
export function ReadyPulse({ trigger }: ReadyPulseProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger <= 0) {
      return;
    }
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timeout);
  }, [trigger]);

  if (!visible) {
    return null;
  }

  return (
    <div className="ready-pulse" aria-hidden="true">
      <span key={trigger} className="ready-pulse__ring" />
    </div>
  );
}
