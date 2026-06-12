import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EyeRestOverlay } from "./EyeRestOverlay";

function renderPrompt(overrides: Partial<Parameters<typeof EyeRestOverlay>[0]> = {}) {
  const props = {
    phase: "prompt" as const,
    gazePoint: null,
    dwellMs: 3000,
    snapRadius: 180,
    neutralZonePercent: 24,
    pauseSeconds: 60,
    followUp: false,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    onPauseComplete: vi.fn(),
    ...overrides,
  };
  render(<EyeRestOverlay {...props} />);
  return props;
}

describe("EyeRestOverlay", () => {
  it("acepta la pausa al elegir Sí", async () => {
    const user = userEvent.setup();
    const props = renderPrompt();

    await user.click(screen.getByRole("button", { name: /Mirada a la derecha/ }));

    expect(props.onAccept).toHaveBeenCalledOnce();
    expect(props.onDecline).not.toHaveBeenCalled();
  });

  it("rechaza la pausa al elegir No", async () => {
    const user = userEvent.setup();
    const props = renderPrompt();

    await user.click(screen.getByRole("button", { name: /Mirada a la izquierda/ }));

    expect(props.onDecline).toHaveBeenCalledOnce();
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("muestra el texto de re-pregunta tras una pausa", () => {
    renderPrompt({ followUp: true });

    expect(screen.getByText("¿Quieres otra pausa de 1 minuto?")).toBeInTheDocument();
  });

  it("llama onPauseComplete al agotar la cuenta atrás", () => {
    vi.useFakeTimers();
    try {
      const onPauseComplete = vi.fn();
      render(
        <EyeRestOverlay
          phase="resting"
          gazePoint={null}
          dwellMs={3000}
          snapRadius={180}
          neutralZonePercent={24}
          pauseSeconds={2}
          followUp={false}
          onAccept={vi.fn()}
          onDecline={vi.fn()}
          onPauseComplete={onPauseComplete}
        />,
      );

      expect(onPauseComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(onPauseComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
