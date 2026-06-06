import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { defaultMiraLinkPreferences } from "../types";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("edits locally and saves the complete preferences object", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);

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
    await user.click(screen.getByLabelText("Negro sobre amarillo"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledWith({
      ...defaultMiraLinkPreferences,
      provider_mode: "pointer",
      theme: "hc-amber",
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

  it("returns to the active form after a successful save", async () => {
    const user = userEvent.setup();
    const onReturnToForm = vi.fn();

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={vi.fn().mockResolvedValue(true)}
        onReturnToForm={onReturnToForm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onReturnToForm).toHaveBeenCalledOnce();
  });

  it("stays in settings when saving fails", async () => {
    const user = userEvent.setup();
    const onReturnToForm = vi.fn();

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={vi.fn().mockResolvedValue(false)}
        onReturnToForm={onReturnToForm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onReturnToForm).not.toHaveBeenCalled();
  });

  it("cancels changes and returns to the active form", async () => {
    const user = userEvent.setup();
    const onReturnToForm = vi.fn();

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={vi.fn()}
        onReturnToForm={onReturnToForm}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Modo de entrada"), "pointer");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByLabelText("Modo de entrada")).toHaveValue("mediapipe");
    expect(onReturnToForm).toHaveBeenCalledOnce();
  });
});
