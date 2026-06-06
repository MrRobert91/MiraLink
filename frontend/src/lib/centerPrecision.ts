import type { GazePoint } from "../types";

/**
 * Ganancia no lineal ("zona de precisión central").
 *
 * Reasigna la posición del puntero con una curva de potencia centrada en el
 * centro de la pantalla: cerca del centro, pequeños desplazamientos de la mirada
 * producen poco movimiento del puntero (control fino, menos saltos accidentales
 * entre SÍ/NO), mientras que en los bordes se conserva el alcance pleno. Con
 * intensidad 0 la transformación es la identidad (mapeo lineal de siempre).
 */
export function applyCenterPrecisionAxis(
  value: number,
  center: number,
  halfRange: number,
  strength: number,
): number {
  if (strength <= 0 || halfRange <= 0) {
    return value;
  }

  const normalized = Math.min(Math.max(strength, 0), 100) / 100;
  const gamma = 1 + normalized * 1.5; // 1.0 (lineal) → 2.5 (control central fuerte)

  const offset = (value - center) / halfRange;
  const clamped = Math.min(Math.max(offset, -1), 1);
  const curved = Math.sign(clamped) * Math.abs(clamped) ** gamma;
  // Conservamos cualquier exceso fuera del rango de forma lineal, para no
  // distorsionar valores que ya estén más allá de los bordes.
  const overshoot = offset - clamped;

  return center + (curved + overshoot) * halfRange;
}

/**
 * Aplica la ganancia no lineal a un punto 2-D usando el centro del viewport como
 * origen y la mitad de cada dimensión como rango.
 */
export function applyCenterPrecision(
  point: GazePoint,
  viewportWidth: number,
  viewportHeight: number,
  strength: number,
): GazePoint {
  return {
    x: applyCenterPrecisionAxis(point.x, viewportWidth / 2, viewportWidth / 2, strength),
    y: applyCenterPrecisionAxis(point.y, viewportHeight / 2, viewportHeight / 2, strength),
  };
}
