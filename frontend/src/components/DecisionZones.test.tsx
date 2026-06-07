import { render, screen } from "@testing-library/react";

import { DecisionZones } from "./DecisionZones";

function renderZones(overrides: Partial<Parameters<typeof DecisionZones>[0]> = {}) {
  const props = {
    header: <p>Pregunta</p>,
    restTitle: "Descanso",
    restHint: "Mira al centro",
    yesLabel: "Sí",
    yesHint: "Mirada a la derecha",
    noLabel: "No",
    noHint: "Mirada a la izquierda",
    focusedTargetId: null as string | null,
    dwellProgress: 0,
    restDwellProgress: 0,
    neutralZonePercent: 24,
    registerTarget: () => () => undefined,
    onAnswerYes: () => undefined,
    onAnswerNo: () => undefined,
    ...overrides,
  };
  return render(<DecisionZones {...props} />);
}

describe("DecisionZones", () => {
  it("marks the focused zone with the active class as visual feedback", () => {
    renderZones({ focusedTargetId: "decision-yes", dwellProgress: 0.4 });

    const yesButton = screen.getByRole("button", { name: /Mirada a la derecha/ });
    expect(yesButton.className).toContain("decision-zone--focused");
  });

  it("hides the rest progress bar before half of the trigger time", () => {
    const { container } = renderZones({ restDwellProgress: 0.4 });
    expect(container.querySelector(".decision-rest-zone__progress")).toBeNull();
  });

  it("shows the rest progress bar after half of the trigger time", () => {
    const { container } = renderZones({ restDwellProgress: 0.75 });
    const bar = container.querySelector(".decision-rest-zone__progress");
    expect(bar).not.toBeNull();
    // 0.75 → (0.75 - 0.5) * 2 = 0.5
    expect((bar as HTMLElement).style.transform).toBe("scaleX(0.5)");
  });
});
