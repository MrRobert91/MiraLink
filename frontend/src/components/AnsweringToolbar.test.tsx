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
        onOpenSettings={onOpenSettings}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configuración" }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.getByText("Paso 3 de 8")).toBeInTheDocument();
  });
});
