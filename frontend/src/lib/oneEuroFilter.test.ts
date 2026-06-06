import { OneEuroFilter, oneEuroOptionsForStabilization } from "./oneEuroFilter";

const stableOptions = { minCutoff: 0.5, beta: 0.02, dCutoff: 1.0 };

describe("OneEuroFilter", () => {
  it("returns the first sample unchanged to initialise its state", () => {
    const filter = new OneEuroFilter(stableOptions);
    expect(filter.filter(100, 0)).toBe(100);
  });

  it("attenuates jitter around a fixed value", () => {
    const filter = new OneEuroFilter(stableOptions);
    const noisy = [500, 512, 489, 507, 494, 503, 498];
    let last = 0;
    noisy.forEach((value, index) => {
      last = filter.filter(value, index * 16.7);
    });
    // El valor filtrado debe quedar mucho más cerca del centro real (~500) que
    // la amplitud del ruido (±12).
    expect(Math.abs(last - 500)).toBeLessThan(6);
  });

  it("tracks a real movement without collapsing to the old value", () => {
    const filter = new OneEuroFilter(stableOptions);
    // Reposo y luego un salto sostenido a 900.
    for (let index = 0; index < 5; index += 1) {
      filter.filter(500, index * 16.7);
    }
    let last = 500;
    for (let index = 5; index < 25; index += 1) {
      last = filter.filter(900, index * 16.7);
    }
    expect(last).toBeGreaterThan(870);
  });

  it("smooths more in steady state when stabilisation is higher", () => {
    const noisy = [500, 530, 470, 525, 475, 520, 480, 515];

    const runWith = (stabilization: number) => {
      const filter = new OneEuroFilter(oneEuroOptionsForStabilization(stabilization));
      const outputs: number[] = [];
      noisy.forEach((value, index) => {
        outputs.push(filter.filter(value, index * 16.7));
      });
      // Variación pico a pico de la salida (sin contar el primer valor crudo).
      const tail = outputs.slice(1);
      return Math.max(...tail) - Math.min(...tail);
    };

    expect(runWith(95)).toBeLessThan(runWith(10));
  });

  it("guards against non-increasing timestamps", () => {
    const filter = new OneEuroFilter(stableOptions);
    filter.filter(100, 1000);
    expect(Number.isFinite(filter.filter(120, 1000))).toBe(true);
  });
});
