import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnsweringToolbar } from "./AnsweringToolbar";

describe("AnsweringToolbar", () => {
  it("opens settings from the immersive answering toolbar", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    render(
      <AnsweringToolbar
        currentStep={3}
        totalSteps={8}
        trackingReady
        onExit={() => undefined}
        onPause={() => undefined}
        onOpenSettings={onOpenSettings}
        onCustomQuestion={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración" }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.getByText("Paso 3 de 8")).toBeInTheDocument();
    // El texto "Seguimiento listo" ya no se muestra.
    expect(screen.queryByText("Seguimiento listo")).not.toBeInTheDocument();
  });

  it("activa la pausa al pulsar el botón Pausa", async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();

    render(
      <AnsweringToolbar
        currentStep={2}
        totalSteps={5}
        trackingReady
        onExit={() => undefined}
        onPause={onPause}
        onOpenSettings={() => undefined}
        onCustomQuestion={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pausa" }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("triggers the custom question flow and shows the initializing label", async () => {
    const user = userEvent.setup();
    const onCustomQuestion = vi.fn();

    render(
      <AnsweringToolbar
        currentStep={1}
        totalSteps={4}
        trackingReady={false}
        onExit={() => undefined}
        onPause={() => undefined}
        onOpenSettings={() => undefined}
        onCustomQuestion={onCustomQuestion}
      />,
    );

    expect(screen.getByText("Inicializando mirada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pregunta personalizada" }));
    expect(onCustomQuestion).toHaveBeenCalledOnce();
  });
});
