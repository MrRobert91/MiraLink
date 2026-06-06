import { useEffect, useState, type ReactNode } from "react";

import { themeOptions, type MiraLinkPreferences, type ThemeName } from "../types";

type SettingsPageProps = {
  preferences: MiraLinkPreferences;
  saving: boolean;
  error: string | null;
  saved: boolean;
  diagnostics?: ReactNode;
  onSave: (preferences: MiraLinkPreferences) => Promise<void> | void;
};

type RangeSettingProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
};

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: RangeSettingProps) {
  return (
    <label className="setting-control">
      <span>
        {label}
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SettingsPage({
  preferences,
  saving,
  error,
  saved,
  diagnostics,
  onSave,
}: SettingsPageProps) {
  const [draft, setDraft] = useState(preferences);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  // Previsualiza el esquema de color en vivo mientras se elige; si se sale sin
  // guardar, se restaura el tema persistido.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", draft.theme);
    return () => {
      document.documentElement.setAttribute("data-theme", preferences.theme);
    };
  }, [draft.theme, preferences.theme]);

  const update = <Key extends keyof MiraLinkPreferences>(
    key: Key,
    value: MiraLinkPreferences[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const selectTheme = (value: ThemeName) => {
    const option = themeOptions.find((item) => item.value === value);
    setDraft((current) => ({
      ...current,
      theme: value,
      high_contrast: option?.highContrast ?? false,
    }));
  };

  return (
    <main className="settings-page page-container">
      <header className="page-heading">
        <p>Personaliza la experiencia ocular</p>
        <h1>Configuración</h1>
        <span>
          Ajusta la respuesta de la mirada y la presentación visual. Los cambios
          solo se aplican cuando los guardas.
        </span>
      </header>

      <section className="settings-panel" aria-label="Accesibilidad">
        <h2 className="settings-section-title">Accesibilidad</h2>
        <p className="settings-section-lead">
          Elige un esquema de color. El tema claro es el predeterminado; los de
          alto contraste ayudan a leer todo con la máxima claridad.
        </p>
        <div className="theme-options" role="radiogroup" aria-label="Esquema de color">
          {themeOptions.map((option) => {
            const active = draft.theme === option.value;
            return (
              <label
                key={option.value}
                className={`theme-option${active ? " theme-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  value={option.value}
                  checked={active}
                  onChange={() => selectTheme(option.value)}
                  aria-label={option.label}
                />
                <span className="theme-option__swatch" aria-hidden="true">
                  {option.swatch.map((color, index) => (
                    <span key={index} style={{ background: color }} />
                  ))}
                </span>
                <span className="theme-option__text">
                  <span className="theme-option__name">
                    {option.label}
                    {active ? (
                      <span className="theme-option__check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span className="theme-option__desc">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="settings-panel" aria-label="Preferencias de MiraLink">
        <label className="setting-control setting-control--select">
          <span>Modo de entrada</span>
          <select
            aria-label="Modo de entrada"
            value={draft.provider_mode}
            onChange={(event) =>
              update(
                "provider_mode",
                event.target.value as MiraLinkPreferences["provider_mode"],
              )
            }
          >
            <option value="mediapipe">Webcam + MediaPipe</option>
            <option value="pointer">Simulación con puntero</option>
          </select>
        </label>

        <div className="settings-grid">
          <RangeSetting
            label="Dwell"
            value={draft.dwell_ms}
            min={1000}
            max={5000}
            step={100}
            suffix=" ms"
            onChange={(value) => update("dwell_ms", value)}
          />
          <RangeSetting
            label="Zona neutra"
            value={draft.neutral_zone_percent}
            min={10}
            max={40}
            step={1}
            suffix="%"
            onChange={(value) => update("neutral_zone_percent", value)}
          />
          <RangeSetting
            label="Estabilización"
            value={draft.stabilization}
            min={55}
            max={92}
            step={1}
            suffix="%"
            onChange={(value) => update("stabilization", value)}
          />
          <RangeSetting
            label="Sensibilidad X"
            value={draft.horizontal_sensitivity}
            min={0.8}
            max={4}
            step={0.05}
            suffix="x"
            onChange={(value) => update("horizontal_sensitivity", value)}
          />
          <RangeSetting
            label="Sensibilidad Y"
            value={draft.vertical_sensitivity}
            min={0.8}
            max={4}
            step={0.05}
            suffix="x"
            onChange={(value) => update("vertical_sensitivity", value)}
          />
          <RangeSetting
            label="Precisión central"
            value={draft.center_precision}
            min={0}
            max={100}
            step={1}
            suffix="%"
            onChange={(value) => update("center_precision", value)}
          />
          <RangeSetting
            label="Opacidad de la cámara"
            value={draft.camera_opacity}
            min={0}
            max={100}
            step={5}
            suffix="%"
            onChange={(value) => update("camera_opacity", value)}
          />
        </div>

        <div className="settings-toggles">
          {[
            ["use_pitch_assist", "Usar pitch"],
            ["invert_vertical_axis", "Invertir eje vertical"],
            ["camera_visible", "Mostrar cámara en calibración"],
          ].map(([key, label]) => (
            <label className="toggle-control" key={key}>
              <span>{label}</span>
              <input
                aria-label={label}
                type="checkbox"
                checked={Boolean(draft[key as keyof MiraLinkPreferences])}
                onChange={(event) =>
                  update(
                    key as "use_pitch_assist" | "invert_vertical_axis" | "camera_visible",
                    event.target.checked,
                  )
                }
              />
            </label>
          ))}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setDraft(preferences)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() => void onSave(draft)}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
        {error ? <p className="inline-message inline-message--error">{error}</p> : null}
        {saved ? <p className="inline-message">Configuración guardada.</p> : null}
      </section>

      {diagnostics ? (
        <details className="diagnostics-disclosure">
          <summary>Diagnóstico avanzado</summary>
          <div className="diagnostics-content">{diagnostics}</div>
        </details>
      ) : null}
    </main>
  );
}
