import { applyCenterPrecision, applyCenterPrecisionAxis } from "./centerPrecision";

describe("applyCenterPrecisionAxis", () => {
  it("is the identity when strength is 0", () => {
    expect(applyCenterPrecisionAxis(300, 500, 500, 0)).toBe(300);
    expect(applyCenterPrecisionAxis(950, 500, 500, 0)).toBe(950);
  });

  it("keeps the exact center fixed", () => {
    expect(applyCenterPrecisionAxis(500, 500, 500, 80)).toBeCloseTo(500, 6);
  });

  it("preserves full reach at the edges", () => {
    expect(applyCenterPrecisionAxis(0, 500, 500, 80)).toBeCloseTo(0, 6);
    expect(applyCenterPrecisionAxis(1000, 500, 500, 80)).toBeCloseTo(1000, 6);
  });

  it("pulls near-center values closer to the center", () => {
    // Mirada un poco a la derecha del centro: con precisión activa, el puntero
    // queda más cerca del centro que sin ella.
    const linear = 600; // 100 px a la derecha del centro
    const curved = applyCenterPrecisionAxis(600, 500, 500, 80);
    expect(curved).toBeLessThan(linear);
    expect(curved).toBeGreaterThan(500);
  });

  it("is monotonic (order preserving)", () => {
    const a = applyCenterPrecisionAxis(540, 500, 500, 80);
    const b = applyCenterPrecisionAxis(560, 500, 500, 80);
    const c = applyCenterPrecisionAxis(580, 500, 500, 80);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("leaves overshoot beyond the range untouched in slope", () => {
    // Un valor más allá del borde derecho se desplaza igual que en lineal.
    expect(applyCenterPrecisionAxis(1100, 500, 500, 80)).toBeCloseTo(1100, 6);
  });

  it("returns the value when the range is degenerate", () => {
    expect(applyCenterPrecisionAxis(300, 0, 0, 80)).toBe(300);
  });
});

describe("applyCenterPrecision (2D)", () => {
  it("applies the curve independently per axis around the viewport center", () => {
    const point = applyCenterPrecision({ x: 600, y: 200 }, 1000, 1000, 80);
    expect(point.x).toBeLessThan(600);
    expect(point.x).toBeGreaterThan(500);
    // y=200 está por debajo del centro (500): debe acercarse al centro (subir).
    expect(point.y).toBeGreaterThan(200);
    expect(point.y).toBeLessThan(500);
  });

  it("is the identity at strength 0", () => {
    const point = applyCenterPrecision({ x: 600, y: 200 }, 1000, 1000, 0);
    expect(point).toEqual({ x: 600, y: 200 });
  });
});
