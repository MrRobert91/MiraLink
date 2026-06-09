import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CustomQuestionOverlay } from "./CustomQuestionOverlay";

function baseProps(overrides: Partial<Parameters<typeof CustomQuestionOverlay>[0]> = {}) {
  return {
    phase: "compose" as const,
    question: "",
    gazePoint: null,
    dwellMs: 3000,
    snapRadius: 180,
    neutralZonePercent: 24,
    yesLabel: "Sí",
    noLabel: "No",
    onShow: vi.fn(),
    onAnswer: vi.fn(),
    onCancel: vi.fn(),
    onAskAnother: vi.fn(),
    onContinueForm: vi.fn(),
    ...overrides,
  };
}

describe("CustomQuestionOverlay", () => {
  it("envía el texto redactado al mostrar la pregunta", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<CustomQuestionOverlay {...props} />);

    const showButton = screen.getByRole("button", { name: "Mostrar al usuario" });
    expect(showButton).toBeDisabled();

    await user.type(screen.getByLabelText("Texto de la pregunta personalizada"), "¿Estás cómodo?");
    await user.click(showButton);

    expect(props.onShow).toHaveBeenCalledWith("¿Estás cómodo?");
  });

  it("registra la respuesta en la fase de pregunta", async () => {
    const user = userEvent.setup();
    const props = baseProps({ phase: "asking", question: "¿Estás cómodo?" });
    render(<CustomQuestionOverlay {...props} />);

    expect(screen.getByText("¿Estás cómodo?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mirada a la derecha/ }));

    expect(props.onAnswer).toHaveBeenCalledWith("Sí");
  });

  it("ofrece hacer otra pregunta o continuar en la fase de seguimiento", async () => {
    const user = userEvent.setup();
    const props = baseProps({ phase: "followup", lastAnswer: "Sí" });
    render(<CustomQuestionOverlay {...props} />);

    expect(screen.getByText(/Respuesta registrada: Sí/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hacer otra pregunta" }));
    expect(props.onAskAnother).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continuar formulario" }));
    expect(props.onContinueForm).toHaveBeenCalled();
  });
});
