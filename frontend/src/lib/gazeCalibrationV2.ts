import type { CalibrationSampleV2, GazeFeatureVector, GazePoint } from "../types";

export type AxisRangeCalibration = {
  observedMin: number;
  observedMax: number;
  targetMin: number;
  targetMax: number;
  invert: boolean;
};

export type AxisAnchorPoint = {
  signal: number;
  target: number;
};

export type AxisAnchorCalibration = {
  points: AxisAnchorPoint[];
};

export type CalibrationApplicationOptions = {
  horizontalSensitivity?: number;
  verticalSensitivity?: number;
};

export type CalibrationTelemetry = {
  signalX: number;
  signalY: number;
  normalizedX: number | null;
  normalizedY: number | null;
  mappedX: number | null;
  mappedY: number | null;
  regressionX: number;
  regressionY: number;
};

export type CalibrationModelV2 = {
  weightsX: number[];
  weightsY: number[];
  score: number;
  sampleCount: number;
  axisRangeX: AxisRangeCalibration | null;
  axisRangeY: AxisRangeCalibration | null;
  axisAnchorsX: AxisAnchorCalibration | null;
  axisAnchorsY: AxisAnchorCalibration | null;
};

const ridgeLambda = 0.01;
const calibrationEdgeExpansionFactor = 0.125;
// Peso de la regresión 2-D en la mezcla con el mapeo por anclas. La regresión
// capta el acoplamiento entre ejes (la señal horizontal varía con la altura de
// la mirada y viceversa), que el mapeo 1-D por anclas ignora; las anclas, a su
// vez, garantizan cobertura de borde a borde. Mezclamos ambos para combinar sus
// fortalezas.
const regressionBlendWeight = 0.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createEmptyCalibrationModelV2(): CalibrationModelV2 {
  return {
    weightsX: [],
    weightsY: [],
    score: 0,
    sampleCount: 0,
    axisRangeX: null,
    axisRangeY: null,
    axisAnchorsX: null,
    axisAnchorsY: null,
  };
}

export function featureVectorToArray(features: GazeFeatureVector) {
  return [
    1,
    features.leftIrisX,
    features.leftIrisY,
    features.rightIrisX,
    features.rightIrisY,
    features.leftEyeOpen,
    features.rightEyeOpen,
    features.interocularDistance,
    features.faceCenterX,
    features.faceCenterY,
    features.faceWidth,
    features.faceHeight,
    features.yaw,
    features.pitch,
    features.roll,
  ];
}

/**
 * Conjunto compacto de features para la regresión por eje. Usa las señales de
 * mirada por eje más su término cruzado para modelar el acoplamiento X↔Y. Es
 * deliberadamente pequeño: con ~11 muestras de calibración, usar las 15 features
 * crudas daría un sistema infradeterminado (más parámetros que muestras) que
 * sobreajusta y generaliza mal.
 */
function regressionFeatureArray(features: GazeFeatureVector) {
  const signalX = getAxisSignal(features, "x");
  const signalY = getAxisSignal(features, "y");
  return [1, signalX, signalY, signalX * signalY];
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-10) {
      continue;
    }

    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];

    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size] ?? 0);
}

function fitAxis(samples: CalibrationSampleV2[], targetKey: "x" | "y") {
  if (samples.length < 4) {
    return [];
  }

  const rows = samples.map((sample) => regressionFeatureArray(sample.features));
  const cols = rows[0]?.length ?? 0;
  if (cols === 0) {
    return [];
  }

  // Estandarizamos cada columna (salvo el sesgo, col 0) a media 0 y desviación 1
  // antes del ridge. Sin esto, las señales de mirada (~0.05) son tan pequeñas
  // que ridgeLambda aplastaría sus pesos y la regresión infraajustaría la
  // pendiente. Tras resolver, reconvertimos los pesos a la escala cruda para que
  // predictWithWeights pueda seguir usando regressionFeatureArray sin cambios.
  const means = new Array<number>(cols).fill(0);
  const stds = new Array<number>(cols).fill(1);
  for (let column = 1; column < cols; column += 1) {
    const values = rows.map((row) => row[column]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    means[column] = mean;
    stds[column] = Math.sqrt(variance) || 1;
  }

  const standardizedRows = rows.map((row) =>
    row.map((value, column) => (column === 0 ? 1 : (value - means[column]) / stds[column])),
  );

  const xtx = Array.from({ length: cols }, () => Array.from({ length: cols }, () => 0));
  const xty = Array.from({ length: cols }, () => 0);

  for (let sampleIndex = 0; sampleIndex < standardizedRows.length; sampleIndex += 1) {
    const row = standardizedRows[sampleIndex];
    const weight = clamp(samples[sampleIndex].quality, 0.01, 1);
    for (let i = 0; i < cols; i += 1) {
      xty[i] += row[i] * samples[sampleIndex].target[targetKey] * weight;
      for (let j = 0; j < cols; j += 1) {
        xtx[i][j] += row[i] * row[j] * weight;
      }
    }
  }

  // No penalizamos el sesgo (col 0).
  for (let diagonal = 1; diagonal < cols; diagonal += 1) {
    xtx[diagonal][diagonal] += ridgeLambda;
  }

  const standardizedWeights = solveLinearSystem(xtx, xty);

  const rawWeights = new Array<number>(cols).fill(0);
  let bias = standardizedWeights[0] ?? 0;
  for (let column = 1; column < cols; column += 1) {
    const weight = standardizedWeights[column] ?? 0;
    rawWeights[column] = weight / stds[column];
    bias -= (weight * means[column]) / stds[column];
  }
  rawWeights[0] = bias;

  return rawWeights;
}

function predictWithWeights(weights: number[], features: GazeFeatureVector) {
  if (weights.length === 0) {
    return 0;
  }

  const featureArray = regressionFeatureArray(features);
  return featureArray.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
}

export function getAxisSignal(features: GazeFeatureVector, axis: "x" | "y") {
  if (axis === "x") {
    const irisHorizontal = ((features.leftIrisX - 0.5) + (features.rightIrisX - 0.5)) / 2;
    return -irisHorizontal - features.yaw * 0.35;
  }

  const irisVertical = ((features.leftIrisY - 0.5) + (features.rightIrisY - 0.5)) / 2;
  return irisVertical;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildExpandedTargetBounds(targetMin: number, targetMax: number) {
  const span = targetMax - targetMin;
  const padding = span * calibrationEdgeExpansionFactor;

  return {
    targetMin: targetMin - padding,
    targetMax: targetMax + padding,
  };
}

function buildAxisAnchors(samples: CalibrationSampleV2[], targetKey: "x" | "y") {
  const uniqueTargets = [...new Set(samples.map((sample) => sample.target[targetKey]))].sort((a, b) => a - b);
  if (uniqueTargets.length < 2) {
    return null;
  }

  const points = uniqueTargets.map((target) => {
    const groupedSamples = samples.filter((sample) => Math.abs(sample.target[targetKey] - target) < 1e-3);
    return {
      target,
      signal: average(groupedSamples.map((sample) => getAxisSignal(sample.features, targetKey))),
    };
  });

  return {
    points,
  };
}

function buildAxisRangeCalibration(samples: CalibrationSampleV2[], weights: number[], targetKey: "x" | "y") {
  if (samples.length < 4 || weights.length === 0) {
    return null;
  }

  const targetValues = samples.map((sample) => sample.target[targetKey]);
  const targetMin = Math.min(...targetValues);
  const targetMax = Math.max(...targetValues);
  const lowEdgeSamples = samples.filter((sample) => Math.abs(sample.target[targetKey] - targetMin) < 1e-3);
  const highEdgeSamples = samples.filter((sample) => Math.abs(sample.target[targetKey] - targetMax) < 1e-3);

  if (lowEdgeSamples.length === 0 || highEdgeSamples.length === 0 || Math.abs(targetMax - targetMin) < 1e-6) {
    return null;
  }

  const observedLow = average(lowEdgeSamples.map((sample) => getAxisSignal(sample.features, targetKey)));
  const observedHigh = average(highEdgeSamples.map((sample) => getAxisSignal(sample.features, targetKey)));
  const observedMin = Math.min(observedLow, observedHigh);
  const observedMax = Math.max(observedLow, observedHigh);

  if (Math.abs(observedMax - observedMin) < 1e-6) {
    return null;
  }

  const expandedTargets = buildExpandedTargetBounds(targetMin, targetMax);

  return {
    observedMin,
    observedMax,
    targetMin: expandedTargets.targetMin,
    targetMax: expandedTargets.targetMax,
    invert: observedLow > observedHigh,
  };
}

function applyAxisRange(value: number, axisRange: AxisRangeCalibration | null, sensitivity = 1) {
  if (!axisRange) {
    return value;
  }

  const observedSpan = axisRange.observedMax - axisRange.observedMin;
  if (Math.abs(observedSpan) < 1e-6) {
    return clamp(value, axisRange.targetMin, axisRange.targetMax);
  }

  let normalized = clamp((value - axisRange.observedMin) / observedSpan, 0, 1);
  if (axisRange.invert) {
    normalized = 1 - normalized;
  }
  const remapped = axisRange.targetMin + normalized * (axisRange.targetMax - axisRange.targetMin);
  const center = (axisRange.targetMin + axisRange.targetMax) / 2;
  const boosted = center + (remapped - center) * sensitivity;

  return clamp(boosted, axisRange.targetMin, axisRange.targetMax);
}

function normalizeAxisSignal(value: number, axisRange: AxisRangeCalibration | null) {
  if (!axisRange) {
    return null;
  }

  const observedSpan = axisRange.observedMax - axisRange.observedMin;
  if (Math.abs(observedSpan) < 1e-6) {
    return null;
  }

  let normalized = clamp((value - axisRange.observedMin) / observedSpan, 0, 1);
  if (axisRange.invert) {
    normalized = 1 - normalized;
  }
  return normalized;
}

function interpolateAxisWithAnchors(value: number, anchors: AxisAnchorCalibration | null) {
  if (!anchors || anchors.points.length < 2) {
    return null;
  }

  const sorted = [...anchors.points].sort((a, b) => a.signal - b.signal);
  let left = sorted[0];
  let right = sorted[1];

  if (value <= sorted[0].signal) {
    left = sorted[0];
    right = sorted[1];
  } else if (value >= sorted[sorted.length - 1].signal) {
    left = sorted[sorted.length - 2];
    right = sorted[sorted.length - 1];
  } else {
    for (let index = 0; index < sorted.length - 1; index += 1) {
      if (value >= sorted[index].signal && value <= sorted[index + 1].signal) {
        left = sorted[index];
        right = sorted[index + 1];
        break;
      }
    }
  }

  const signalSpan = right.signal - left.signal;
  if (Math.abs(signalSpan) < 1e-6) {
    return left.target;
  }

  const ratio = (value - left.signal) / signalSpan;
  return left.target + ratio * (right.target - left.target);
}

function applyAxisCalibration(
  signal: number,
  axisRange: AxisRangeCalibration | null,
  axisAnchors: AxisAnchorCalibration | null,
  sensitivity = 1,
) {
  const anchorTarget = interpolateAxisWithAnchors(signal, axisAnchors);
  const baseTarget = anchorTarget ?? applyAxisRange(signal, axisRange, 1);
  const rangeMin = axisRange?.targetMin ?? Math.min(...(axisAnchors?.points.map((point) => point.target) ?? [baseTarget]));
  const rangeMax = axisRange?.targetMax ?? Math.max(...(axisAnchors?.points.map((point) => point.target) ?? [baseTarget]));
  const center = (rangeMin + rangeMax) / 2;
  const boosted = center + (baseTarget - center) * sensitivity;

  return clamp(boosted, rangeMin, rangeMax);
}

export function expandPointWithAxisRanges(
  point: GazePoint,
  model: CalibrationModelV2,
  options?: CalibrationApplicationOptions,
): GazePoint {
  return {
    x: applyAxisRange(point.x, model.axisRangeX, options?.horizontalSensitivity ?? 1),
    y: applyAxisRange(point.y, model.axisRangeY, options?.verticalSensitivity ?? 1),
  };
}

export function applyCalibrationToFrame(
  features: GazeFeatureVector,
  model: CalibrationModelV2,
  options?: CalibrationApplicationOptions,
): GazePoint {
  const regressionPoint = {
    x: predictWithWeights(model.weightsX, features),
    y: predictWithWeights(model.weightsY, features),
  };
  const signalPoint = {
    x: getAxisSignal(features, "x"),
    y: getAxisSignal(features, "y"),
  };
  // El boost de sensibilidad se aplica una vez sobre la mezcla final (abajo),
  // así que aquí calibramos sin él (sensibilidad = 1).
  const calibratedPoint = {
    x: applyAxisCalibration(signalPoint.x, model.axisRangeX, model.axisAnchorsX, 1),
    y: applyAxisCalibration(signalPoint.y, model.axisRangeY, model.axisAnchorsY, 1),
  };

  return {
    x: blendAxisPrediction(
      regressionPoint.x,
      calibratedPoint.x,
      model.axisRangeX,
      model.axisAnchorsX,
      options?.horizontalSensitivity ?? 1,
    ),
    y: blendAxisPrediction(
      regressionPoint.y,
      calibratedPoint.y,
      model.axisRangeY,
      model.axisAnchorsY,
      options?.verticalSensitivity ?? 1,
    ),
  };
}

/**
 * Mezcla la predicción de la regresión 2-D con la del mapeo por anclas/rango y
 * aplica el boost de sensibilidad alrededor del centro del rango, recortando al
 * rango calibrado para no extrapolar fuera de la pantalla. Si no hay rango ni
 * anclas (modelo vacío), devuelve la regresión tal cual.
 */
function blendAxisPrediction(
  regressionValue: number,
  calibratedValue: number,
  axisRange: AxisRangeCalibration | null,
  axisAnchors: AxisAnchorCalibration | null,
  sensitivity: number,
) {
  if (!axisRange && !axisAnchors) {
    return regressionValue;
  }

  const anchorTargets = axisAnchors?.points.map((point) => point.target) ?? [calibratedValue];
  const rangeMin = axisRange?.targetMin ?? Math.min(...anchorTargets);
  const rangeMax = axisRange?.targetMax ?? Math.max(...anchorTargets);
  const blended = regressionBlendWeight * regressionValue + (1 - regressionBlendWeight) * calibratedValue;
  const center = (rangeMin + rangeMax) / 2;
  const boosted = center + (blended - center) * sensitivity;

  return clamp(boosted, rangeMin, rangeMax);
}

export function buildCalibrationTelemetry(
  features: GazeFeatureVector,
  model: CalibrationModelV2,
  options?: CalibrationApplicationOptions,
): CalibrationTelemetry {
  const signalX = getAxisSignal(features, "x");
  const signalY = getAxisSignal(features, "y");
  const regressionX = predictWithWeights(model.weightsX, features);
  const regressionY = predictWithWeights(model.weightsY, features);

  return {
    signalX,
    signalY,
    normalizedX: normalizeAxisSignal(signalX, model.axisRangeX),
    normalizedY: normalizeAxisSignal(signalY, model.axisRangeY),
    mappedX:
      model.axisRangeX || model.axisAnchorsX
        ? applyAxisCalibration(signalX, model.axisRangeX, model.axisAnchorsX, options?.horizontalSensitivity ?? 1)
        : null,
    mappedY:
      model.axisRangeY || model.axisAnchorsY
        ? applyAxisCalibration(signalY, model.axisRangeY, model.axisAnchorsY, options?.verticalSensitivity ?? 1)
        : null,
    regressionX,
    regressionY,
  };
}

export function buildCalibrationModelV2(samples: CalibrationSampleV2[]): CalibrationModelV2 {
  if (samples.length < 4) {
    return createEmptyCalibrationModelV2();
  }

  const weightsX = fitAxis(samples, "x");
  const weightsY = fitAxis(samples, "y");
  const axisRangeX = buildAxisRangeCalibration(samples, weightsX, "x");
  const axisRangeY = buildAxisRangeCalibration(samples, weightsY, "y");
  const axisAnchorsX = buildAxisAnchors(samples, "x");
  const axisAnchorsY = buildAxisAnchors(samples, "y");

  const meanAbsoluteError =
    samples.reduce((sum, sample) => {
      const predicted = applyCalibrationToFrame(sample.features, {
        weightsX,
        weightsY,
        score: 0,
        sampleCount: samples.length,
        axisRangeX,
        axisRangeY,
        axisAnchorsX,
        axisAnchorsY,
      });
      return sum + Math.abs(predicted.x - sample.target.x) + Math.abs(predicted.y - sample.target.y);
    }, 0) /
    (samples.length * 2);

  return {
    weightsX,
    weightsY,
    score: clamp(1 - meanAbsoluteError / 220, 0, 1),
    sampleCount: samples.length,
    axisRangeX,
    axisRangeY,
    axisAnchorsX,
    axisAnchorsY,
  };
}

export function isCalibrationWindowStable(points: GazePoint[], maxDistance: number) {
  if (points.length < 3) {
    return false;
  }

  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  return points.every((point) => Math.hypot(point.x - center.x, point.y - center.y) <= maxDistance);
}

function featureDistance(a: GazeFeatureVector, b: GazeFeatureVector) {
  return Math.hypot(
    (a.leftIrisX - b.leftIrisX) * 2.4,
    (a.leftIrisY - b.leftIrisY) * 2.4,
    (a.rightIrisX - b.rightIrisX) * 2.4,
    (a.rightIrisY - b.rightIrisY) * 2.4,
    (a.yaw - b.yaw) * 1.2,
    (a.pitch - b.pitch) * 1.2,
  );
}

export function getFeatureWindowSpread(vectors: GazeFeatureVector[]) {
  if (vectors.length < 2) {
    return 0;
  }

  const center = averageFeatureVectors(vectors);
  if (!center) {
    return 0;
  }

  return Math.max(...vectors.map((vector) => featureDistance(vector, center)));
}

export function isFeatureWindowStable(vectors: GazeFeatureVector[], maxDistance: number) {
  if (vectors.length < 4) {
    return false;
  }

  return getFeatureWindowSpread(vectors) <= maxDistance;
}

export function averageFeatureVectors(vectors: GazeFeatureVector[]) {
  if (vectors.length === 0) {
    return null;
  }

  const totals = vectors.reduce<Record<keyof GazeFeatureVector, number>>(
    (accumulator, vector) => {
      for (const [key, value] of Object.entries(vector) as Array<[keyof GazeFeatureVector, number]>) {
        accumulator[key] += value;
      }
      return accumulator;
    },
    {
      leftIrisX: 0,
      leftIrisY: 0,
      rightIrisX: 0,
      rightIrisY: 0,
      leftEyeOpen: 0,
      rightEyeOpen: 0,
      interocularDistance: 0,
      faceCenterX: 0,
      faceCenterY: 0,
      faceWidth: 0,
      faceHeight: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    },
  );

  const count = vectors.length;
  return {
    leftIrisX: totals.leftIrisX / count,
    leftIrisY: totals.leftIrisY / count,
    rightIrisX: totals.rightIrisX / count,
    rightIrisY: totals.rightIrisY / count,
    leftEyeOpen: totals.leftEyeOpen / count,
    rightEyeOpen: totals.rightEyeOpen / count,
    interocularDistance: totals.interocularDistance / count,
    faceCenterX: totals.faceCenterX / count,
    faceCenterY: totals.faceCenterY / count,
    faceWidth: totals.faceWidth / count,
    faceHeight: totals.faceHeight / count,
    yaw: totals.yaw / count,
    pitch: totals.pitch / count,
    roll: totals.roll / count,
  };
}
