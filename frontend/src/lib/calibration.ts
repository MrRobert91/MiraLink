import type { GazePoint } from "../types";

export const calibrationPointPercentages = [
  // Fila superior (y = 10)
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  // Fila central (y = 50) con 5 puntos para reforzar el eje horizontal medio
  { x: 10, y: 50 },
  { x: 30, y: 50 },
  { x: 50, y: 50 },
  { x: 70, y: 50 },
  { x: 90, y: 50 },
  // Fila inferior (y = 90)
  { x: 10, y: 90 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
] as const;

export function resolveCalibrationTarget(index: number, viewportWidth: number, viewportHeight: number): GazePoint {
  const point = calibrationPointPercentages[Math.min(Math.max(index, 0), calibrationPointPercentages.length - 1)];
  return {
    x: (point.x / 100) * viewportWidth,
    y: (point.y / 100) * viewportHeight,
  };
}
