import {
  applyCalibrationToFrame,
  buildCalibrationModelV2,
  createEmptyCalibrationModelV2,
  expandPointWithAxisRanges,
  isFeatureWindowStable,
  isCalibrationWindowStable,
} from "./gazeCalibrationV2";
import type { CalibrationSampleV2, GazeFeatureVector } from "../types";

function createFeatures(xBias: number, yBias: number): GazeFeatureVector {
  return {
    leftIrisX: 0.35 + xBias,
    leftIrisY: 0.5 + yBias,
    rightIrisX: 0.65 + xBias,
    rightIrisY: 0.5 + yBias,
    leftEyeOpen: 0.24,
    rightEyeOpen: 0.23,
    interocularDistance: 0.3,
    faceCenterX: 0.5,
    faceCenterY: 0.5,
    faceWidth: 0.44,
    faceHeight: 0.58,
    yaw: xBias * 1.2,
    pitch: yBias * 1.2,
    roll: 0,
  };
}

describe("feature-based calibration", () => {
  it("returns an empty model when there are not enough stable samples", () => {
    const model = buildCalibrationModelV2([]);
    expect(model).toEqual(createEmptyCalibrationModelV2());
  });

  it("learns a screen mapping from feature vectors", () => {
    const samples: CalibrationSampleV2[] = [
      { features: createFeatures(-0.06, -0.06), target: { x: 200, y: 160 }, quality: 0.92 },
      { features: createFeatures(0, -0.05), target: { x: 640, y: 180 }, quality: 0.95 },
      { features: createFeatures(0.05, -0.04), target: { x: 1080, y: 210 }, quality: 0.94 },
      { features: createFeatures(-0.04, 0.01), target: { x: 260, y: 420 }, quality: 0.91 },
      { features: createFeatures(0.01, 0.02), target: { x: 700, y: 470 }, quality: 0.96 },
      { features: createFeatures(0.05, 0.05), target: { x: 1100, y: 560 }, quality: 0.93 },
    ];

    const model = buildCalibrationModelV2(samples);
    const point = applyCalibrationToFrame(createFeatures(0.02, 0.015), model);

    expect(model.sampleCount).toBe(samples.length);
    expect(model.score).toBeGreaterThan(0.7);
    expect(point.x).toBeGreaterThan(760);
    expect(point.x).toBeLessThan(980);
    expect(point.y).toBeGreaterThan(430);
    expect(point.y).toBeLessThan(620);
    expect(model.axisRangeX).not.toBeNull();
    expect(model.axisRangeY).not.toBeNull();
    expect(model.axisAnchorsX?.points.length).toBeGreaterThanOrEqual(3);
    expect(model.axisAnchorsY?.points.length).toBeGreaterThanOrEqual(2);
    expect(model.axisRangeX?.targetMin).toBeLessThan(200);
    expect(model.axisRangeX?.targetMax).toBeGreaterThan(1080);
  });

  it("auto-tunes the blend weight and scores honestly (lower for noisier data)", () => {
    const clean: CalibrationSampleV2[] = [
      { features: createFeatures(-0.06, -0.06), target: { x: 200, y: 160 }, quality: 0.95 },
      { features: createFeatures(0, -0.05), target: { x: 640, y: 180 }, quality: 0.95 },
      { features: createFeatures(0.05, -0.04), target: { x: 1080, y: 210 }, quality: 0.95 },
      { features: createFeatures(-0.04, 0.01), target: { x: 260, y: 420 }, quality: 0.95 },
      { features: createFeatures(0.01, 0.02), target: { x: 700, y: 470 }, quality: 0.95 },
      { features: createFeatures(0.05, 0.05), target: { x: 1100, y: 560 }, quality: 0.95 },
    ];

    const cleanModel = buildCalibrationModelV2(clean);
    // El peso de mezcla queda fijado a uno de los candidatos del auto-ajuste.
    expect([0, 0.25, 0.5, 0.75, 1]).toContain(cleanModel.blendWeight);
    expect(cleanModel.score).toBeGreaterThan(0);
    expect(cleanModel.score).toBeLessThanOrEqual(1);

    // Mismas señales pero objetivos incoherentes: la relación señal→pantalla se
    // vuelve impredecible, así que la validación cruzada debe penalizar el score.
    const noisy = clean.map((sample, index) => ({
      ...sample,
      target: {
        x: sample.target.x + (index % 2 === 0 ? -260 : 260),
        y: sample.target.y + (index % 2 === 0 ? 200 : -200),
      },
    }));

    const noisyModel = buildCalibrationModelV2(noisy);
    expect(noisyModel.score).toBeLessThan(cleanModel.score);
  });

  it("expands a compressed calibrated point to the observed target span", () => {
    const expanded = expandPointWithAxisRanges(
      { x: 420, y: 360 },
      {
        weightsX: [],
        weightsY: [],
        score: 0,
        sampleCount: 9,
        axisRangeX: {
          observedMin: 350,
          observedMax: 450,
          targetMin: 120,
          targetMax: 1160,
          invert: false,
        },
        axisRangeY: {
          observedMin: 300,
          observedMax: 400,
          targetMin: 100,
          targetMax: 700,
          invert: false,
        },
        axisAnchorsX: null,
        axisAnchorsY: null,
      },
      {
        horizontalSensitivity: 1,
        verticalSensitivity: 1,
      },
    );

    expect(expanded.x).toBeCloseTo(848, 0);
    expect(expanded.y).toBeCloseTo(460, 0);
  });

  it("applies per-axis sensitivity around the calibrated center", () => {
    const neutral = expandPointWithAxisRanges(
      { x: 430, y: 380 },
      {
        weightsX: [],
        weightsY: [],
        score: 0,
        sampleCount: 9,
        axisRangeX: {
          observedMin: 350,
          observedMax: 450,
          targetMin: 100,
          targetMax: 1100,
          invert: false,
        },
        axisRangeY: {
          observedMin: 300,
          observedMax: 400,
          targetMin: 80,
          targetMax: 680,
          invert: false,
        },
        axisAnchorsX: null,
        axisAnchorsY: null,
      },
      {
        horizontalSensitivity: 1,
        verticalSensitivity: 1,
      },
    );

    const boosted = expandPointWithAxisRanges(
      { x: 430, y: 380 },
      {
        weightsX: [],
        weightsY: [],
        score: 0,
        sampleCount: 9,
        axisRangeX: {
          observedMin: 350,
          observedMax: 450,
          targetMin: 100,
          targetMax: 1100,
          invert: false,
        },
        axisRangeY: {
          observedMin: 300,
          observedMax: 400,
          targetMin: 80,
          targetMax: 680,
          invert: false,
        },
        axisAnchorsX: null,
        axisAnchorsY: null,
      },
      {
        horizontalSensitivity: 1.4,
        verticalSensitivity: 1.3,
      },
    );

    expect(boosted.x).toBeGreaterThan(neutral.x);
    expect(boosted.y).toBeGreaterThan(neutral.y);
  });

  it("detects when a calibration window is stable enough to capture", () => {
    const stableWindow = [
      { x: 502, y: 401 },
      { x: 504, y: 399 },
      { x: 500, y: 403 },
      { x: 503, y: 400 },
    ];
    const unstableWindow = [
      { x: 420, y: 300 },
      { x: 550, y: 410 },
      { x: 510, y: 460 },
      { x: 610, y: 350 },
    ];

    expect(isCalibrationWindowStable(stableWindow, 18)).toBe(true);
    expect(isCalibrationWindowStable(unstableWindow, 18)).toBe(false);
  });

  it("detects stable feature windows independently from the raw point spread", () => {
    const stableFeatures = [
      createFeatures(0.01, -0.01),
      createFeatures(0.011, -0.009),
      createFeatures(0.009, -0.011),
      createFeatures(0.01, -0.008),
    ];
    const unstableFeatures = [
      createFeatures(-0.08, -0.05),
      createFeatures(0.01, 0.04),
      createFeatures(0.06, -0.02),
      createFeatures(-0.03, 0.08),
    ];

    expect(isFeatureWindowStable(stableFeatures, 0.08)).toBe(true);
    expect(isFeatureWindowStable(unstableFeatures, 0.08)).toBe(false);
  });
});
