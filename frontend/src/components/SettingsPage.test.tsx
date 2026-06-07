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

  it("guarda el ajuste de pausa visual de descanso", async () => {
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

    // El ajuste viene activado por defecto; al pulsar se desactiva.
    await user.click(screen.getByLabelText("Pausa visual de descanso"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledWith({
      ...defaultMiraLinkPreferences,
      eye_rest_enabled: false,
    });
  });

  it("revela el selector de voz al activar la lectura y guarda la voz elegida", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <SettingsPage
        preferences={defaultMiraLinkPreferences}
        saving={false}
        error={null}
        saved={false}
        onSave={onSave}
        ttsVoices={[
          { id: "browser:Helena", label: "Helena (es-ES)", engine: "browser", lang: "es-ES" },
          { id: "piper:es_ES-davefx-medium", label: "Español (Piper)", engine: "piper", lang: "es-ES" },
        ]}
      />,
    );

    // Con la lectura desactivada (por defecto) no aparece el selector de voz.
    expect(screen.queryByLabelText("Voz")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Leer en voz alta"));
    await user.selectOptions(screen.getByLabelText("Voz"), "piper:es_ES-davefx-medium");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledWith({
      ...defaultMiraLinkPreferences,
      tts_enabled: true,
      tts_voice_id: "piper:es_ES-davefx-medium",
    });
  });

  it("avisa cuando el navegador no tiene voces disponibles", () => {
    render(
      <SettingsPage
        preferences={{ ...defaultMiraLinkPreferences, tts_enabled: true }}
        saving={false}
        error={null}
        saved={false}
        onSave={vi.fn()}
        ttsBrowserSupported={false}
      />,
    );

    expect(
      screen.getByText(/no está disponible en este dispositivo/i),
    ).toBeInTheDocument();
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
