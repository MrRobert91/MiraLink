import { normalizeThemeName, themeOptions } from "./types";

describe("MiraLink themes", () => {
  it("replaces the removed yellow-on-black theme with dark", () => {
    expect(normalizeThemeName("hc-yellow")).toBe("dark");
  });

  it("offers colorblind mode without yellow-on-black", () => {
    expect(themeOptions.map((option) => option.value)).toContain("colorblind");
    expect(themeOptions.map((option) => option.value)).not.toContain("hc-yellow");
  });
});
