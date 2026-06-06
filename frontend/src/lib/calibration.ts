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

export type CalibrationSample = {
  raw: GazePoint;
  target: GazePoint;
};

export type CalibrationModel = {
  scaleX: number;
  offsetX: number;
  scaleY: number;
  offsetY: number;
  score: number;
};

export function identityCalibration(): CalibrationModel {
  return {
    scaleX: 1,
    offsetX: 0,
    scaleY: 1,
    offsetY: 0,
    score: 0,
  };
}

function fitAxis(rawValues: number[], targetValues: number[]): { scale: number; offset: number; mae: number } {
  if (rawValues.length < 2) {
    return { scale: 1, offset: 0, mae: 0 };
  }

  const meanRaw = rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length;
  const meanTarget = targetValues.reduce((sum, value) => sum + value, 0) / targetValues.length;

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < rawValues.length; index += 1) {
    numerator += (rawValues[index] - meanRaw) * (targetValues[index] - meanTarget);
    denominator += (rawValues[index] - meanRaw) ** 2;
  }

  const scale = denominator === 0 ? 1 : numerator / denominator;
  const offset = meanTarget - scale * meanRaw;
  const mae =
    rawValues.reduce((sum, value, index) => sum + Math.abs(scale * value + offset - targetValues[index]), 0) /
    rawValues.length;

  return { scale, offset, mae };
}

export function buildCalibrationModel(samples: CalibrationSample[]): CalibrationModel {
  if (samples.length < 3) {
    return identityCalibration();
  }

  const xFit = fitAxis(
    samples.map((sample) => sample.raw.x),
    samples.map((sample) => sample.target.x),
  );
  const yFit = fitAxis(
    samples.map((sample) => sample.raw.y),
    samples.map((sample) => sample.target.y),
  );

  const averageError = (xFit.mae + yFit.mae) / 2;
  return {
    scaleX: xFit.scale,
    offsetX: xFit.offset,
    scaleY: yFit.scale,
    offsetY: yFit.offset,
    score: Math.max(0, 1 - averageError / 150),
  };
}

export function averageGazePoints(points: GazePoint[]): GazePoint | null {
  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function resolveCalibrationTarget(index: number, viewportWidth: number, viewportHeight: number): GazePoint {
  const point = calibrationPointPercentages[Math.min(Math.max(index, 0), calibrationPointPercentages.length - 1)];
  return {
    x: (point.x / 100) * viewportWidth,
    y: (point.y / 100) * viewportHeight,
  };
}

export function applyCalibration(point: GazePoint, model: CalibrationModel): GazePoint {
  return {
    x: point.x * model.scaleX + model.offsetX,
    y: point.y * model.scaleY + model.offsetY,
  };
}
