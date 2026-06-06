import { resolveCalibrationTarget } from "./calibration";

describe("calibration targets", () => {
  it("maps calibration points to viewport coordinates", () => {
    expect(resolveCalibrationTarget(0, 1000, 800)).toEqual({ x: 100, y: 80 });
    expect(resolveCalibrationTarget(5, 1000, 800)).toEqual({ x: 500, y: 400 });
    expect(resolveCalibrationTarget(10, 1000, 800)).toEqual({ x: 900, y: 720 });
  });

  it("clamps out-of-range indices to the available points", () => {
    expect(resolveCalibrationTarget(-3, 1000, 800)).toEqual({ x: 100, y: 80 });
    expect(resolveCalibrationTarget(99, 1000, 800)).toEqual({ x: 900, y: 720 });
  });
});
