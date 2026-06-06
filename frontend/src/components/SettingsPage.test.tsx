import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { defaultMiraLinkPreferences } from "../types";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("edits locally and saves the complete preferences object", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={onSave}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Modo de entrada"), "pointer");
    await user.click(screen.getByLabelText("Contraste alto"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledWith({
      ...defaultMiraLinkPreferences,
      provider_mode: "pointer",
      high_contrast: true,
    });
  });

  it("restores the saved values when cancel is pressed", async () => {
    const user = userEvent.setup();

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Modo de entrada"), "pointer");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByLabelText("Modo de entrada")).toHaveValue("mediapipe");
  });
});
