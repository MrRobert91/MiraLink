import {
  averageGazePoints,
  applyCalibration,
  buildCalibrationModel,
  identityCalibration,
  resolveCalibrationTarget,
  type CalibrationSample,
} from "./calibration";

describe("calibration model", () => {
  it("returns identity when there are not enough samples", () => {
    const model = buildCalibrationModel([]);
    expect(model).toEqual(identityCalibration());
  });

  it("fits a simple affine transform for screen coordinates", () => {
    const samples: CalibrationSample[] = [
      { raw: { x: 100, y: 100 }, target: { x: 120, y: 140 } },
      { raw: { x: 200, y: 200 }, target: { x: 230, y: 250 } },
      { raw: { x: 300, y: 300 }, target: { x: 340, y: 360 } },
    ];

    const model = buildCalibrationModel(samples);
    const corrected = applyCalibration({ x: 250, y: 250 }, model);

    expect(corrected.x).toBeCloseTo(285, 0);
    expect(corrected.y).toBeCloseTo(305, 0);
    expect(model.score).toBeGreaterThan(0.9);
  });

  it("averages gaze samples to reduce noise during timed calibration", () => {
    const average = averageGazePoints([
      { x: 100, y: 210 },
      { x: 110, y: 200 },
      { x: 120, y: 190 },
    ]);

    expect(average).toEqual({ x: 110, y: 200 });
  });

  it("returns null when there are no gaze samples to average", () => {
    expect(averageGazePoints([])).toBeNull();
  });

  it("maps calibration points to viewport coordinates", () => {
    expect(resolveCalibrationTarget(0, 1000, 800)).toEqual({ x: 100, y: 80 });
    expect(resolveCalibrationTarget(5, 1000, 800)).toEqual({ x: 500, y: 400 });
    expect(resolveCalibrationTarget(10, 1000, 800)).toEqual({ x: 900, y: 720 });
  });
});
