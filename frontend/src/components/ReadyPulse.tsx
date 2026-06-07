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
    // Debe cubrir la animación más larga (anillo retardado): 0.9s + 0.12s delay.
    const timeout = window.setTimeout(() => setVisible(false), 1050);
    return () => window.clearTimeout(timeout);
  }, [trigger]);

  if (!visible) {
    return null;
  }

  return (
    <div className="ready-pulse" aria-hidden="true">
      <span key={`${trigger}-a`} className="ready-pulse__ring" />
      <span key={`${trigger}-b`} className="ready-pulse__ring ready-pulse__ring--delayed" />
    </div>
  );
}
