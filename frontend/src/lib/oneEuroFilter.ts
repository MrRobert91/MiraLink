/**
 * Filtro One-Euro (Casiez et al., 2012) para suavizar señales ruidosas en
 * tiempo real con un compromiso adaptativo entre estabilidad y retardo:
 * cuando la señal está casi quieta aplica mucho suavizado (mata el temblor) y
 * cuando se mueve rápido reduce el suavizado (poco retardo). Es el estándar de
 * facto para punteros de mirada/ratón.
 *
 * Referencia: https://gery.casiez.net/1euro/
 */

export type OneEuroOptions = {
  /** Frecuencia de corte mínima en Hz. Más baja = más suavizado en reposo. */
  minCutoff: number;
  /** Cuánto se reduce el suavizado con la velocidad. Más alto = menos retardo. */
  beta: number;
  /** Frecuencia de corte para el filtrado de la derivada (Hz). */
  dCutoff: number;
};

function smoothingAlpha(cutoffHz: number, dtSeconds: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

function lowpass(previous: number, value: number, alpha: number) {
  return previous + alpha * (value - previous);
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(options: OneEuroOptions) {
    this.minCutoff = options.minCutoff;
    this.beta = options.beta;
    this.dCutoff = options.dCutoff;
  }

  setOptions(options: OneEuroOptions) {
    this.minCutoff = options.minCutoff;
    this.beta = options.beta;
    this.dCutoff = options.dCutoff;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /**
   * Filtra `value` para el instante `timestampMs` (en milisegundos, p. ej.
   * `performance.now()`). El primer valor se devuelve sin filtrar para
   * inicializar el estado.
   */
  filter(value: number, timestampMs: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.tPrev = timestampMs;
      this.xPrev = value;
      this.dxPrev = 0;
      return value;
    }

    let dt = (timestampMs - this.tPrev) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) {
      dt = 1 / 60;
    }

    const dx = (value - this.xPrev) / dt;
    const dxHat = lowpass(this.dxPrev, dx, smoothingAlpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = lowpass(this.xPrev, value, smoothingAlpha(cutoff, dt));

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = timestampMs;
    return xHat;
  }
}

/**
 * Traduce el ajuste de "estabilización" de la UI (0–100) a parámetros del
 * filtro. A mayor estabilización, menor frecuencia de corte mínima (más
 * suavizado en reposo). `beta` se mantiene pequeño a propósito para que el
 * temblor de reposo (velocidades bajas) no dispare la frecuencia de corte; solo
 * los movimientos reales y rápidos reducen el suavizado.
 */
export function oneEuroOptionsForStabilization(stabilization: number): OneEuroOptions {
  const normalized = Math.min(Math.max(stabilization, 0), 100) / 100;
  return {
    minCutoff: 2.0 - normalized * 1.6, // 2.0 Hz (poco suavizado) → 0.4 Hz (mucho)
    beta: 0.02,
    dCutoff: 1.0,
  };
}
