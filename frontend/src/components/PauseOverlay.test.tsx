import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PauseOverlay } from "./PauseOverlay";

describe("PauseOverlay", () => {
  it("muestra el estado de pausa y reanuda al pulsar el botón", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();

    render(<PauseOverlay onResume={onResume} />);

    expect(screen.getByText("En pausa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reanudar" }));
    expect(onResume).toHaveBeenCalledOnce();
  });
});
