import { buildDecisionGridColumns, resolveBinaryDecisionTarget, resolveRestBand } from "./decisionZone";

const targets = [
  { id: "decision-no", x: 0, y: 100, width: 320, height: 300 },
  { id: "decision-rest", x: 360, y: 100, width: 280, height: 300 },
  { id: "decision-yes", x: 680, y: 100, width: 320, height: 300 },
];

describe("binary decision zone resolver", () => {
  it("returns null when the gaze is inside the central rest band", () => {
    expect(resolveBinaryDecisionTarget({ x: 500, y: 200 }, targets)).toBeNull();
  });

  it("maps the whole left side to no and the whole right side to yes", () => {
    expect(resolveBinaryDecisionTarget({ x: 100, y: 200 }, targets)).toBe("decision-no");
    expect(resolveBinaryDecisionTarget({ x: 900, y: 200 }, targets)).toBe("decision-yes");
  });

  it("keeps the side selection above or below the visible boxes", () => {
    // Far above the box (y < box top) still counts because vertical position is ignored.
    expect(resolveBinaryDecisionTarget({ x: 100, y: 0 }, targets)).toBe("decision-no");
    // Far below the box (y > box bottom) on the right side.
    expect(resolveBinaryDecisionTarget({ x: 900, y: 2000 }, targets)).toBe("decision-yes");
    // Even outside the left box edge (x left of box) it is still the no side.
    expect(resolveBinaryDecisionTarget({ x: -50, y: 200 }, targets)).toBe("decision-no");
  });

  it("cancels the selection only when crossing into the rest band", () => {
    // Just left of the rest band -> still no.
    expect(resolveBinaryDecisionTarget({ x: 359, y: 200 }, targets)).toBe("decision-no");
    // Inside the rest band -> neutral.
    expect(resolveBinaryDecisionTarget({ x: 361, y: 200 }, targets)).toBeNull();
    // Just right of the rest band -> yes.
    expect(resolveBinaryDecisionTarget({ x: 641, y: 200 }, targets)).toBe("decision-yes");
  });

  it("returns null when there is no gaze point", () => {
    expect(resolveBinaryDecisionTarget(null, targets)).toBeNull();
  });

  it("falls back to a viewport-centered band when the rest target is missing", () => {
    const targetsWithoutRest = targets.filter((target) => target.id !== "decision-rest");
    // restPercent 24 over a 1000px viewport => sides of 380px, band 380..620.
    expect(resolveBinaryDecisionTarget({ x: 300, y: 200 }, targetsWithoutRest, 24, 1000)).toBe("decision-no");
    expect(resolveBinaryDecisionTarget({ x: 500, y: 200 }, targetsWithoutRest, 24, 1000)).toBeNull();
    expect(resolveBinaryDecisionTarget({ x: 700, y: 200 }, targetsWithoutRest, 24, 1000)).toBe("decision-yes");
  });

  it("derives the rest band from the rendered rest element when present", () => {
    expect(resolveRestBand(targets, 24, 1000)).toEqual({ left: 360, right: 640 });
  });

  it("builds symmetric grid columns for the configured rest width", () => {
    expect(buildDecisionGridColumns(24)).toEqual(["38%", "24%", "38%"]);
    expect(buildDecisionGridColumns(40)).toEqual(["30%", "40%", "30%"]);
  });
});
