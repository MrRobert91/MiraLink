import { useEffect, useMemo, useState, type ReactNode } from "react";

import { themeOptions, type MiraLinkPreferences, type ThemeName, type Voice } from "../types";

const ENGINE_LABELS: Record<string, string> = {
  browser: "Navegador",
  piper: "Piper",
  kokoro: "Kokoro",
};

type SettingsPageProps = {
  preferences: MiraLinkPreferences;
  saving: boolean;
  error: string | null;
  saved: boolean;
  diagnostics?: ReactNode;
  /** Catálogo de voces disponibles (navegador + backend) para el selector. */
  ttsVoices?: Voice[];
  /** Falso si el navegador no expone ninguna voz en este dispositivo. */
  ttsBrowserSupported?: boolean;
  onSave: (preferences: MiraLinkPreferences) => Promise<boolean> | boolean;
  onReturnToForm?: () => void;
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
  ttsVoices = [],
  ttsBrowserSupported = true,
  onSave,
  onReturnToForm,
}: SettingsPageProps) {
  const [draft, setDraft] = useState(preferences);

  // Voces agrupadas por motor para el desplegable (Navegador / Piper / …).
  const voicesByEngine = useMemo(() => {
    const groups = new Map<string, Voice[]>();
    for (const voice of ttsVoices) {
      const list = groups.get(voice.engine) ?? [];
      list.push(voice);
      groups.set(voice.engine, list);
    }
    return groups;
  }, [ttsVoices]);

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

  const cancelChanges = () => {
    setDraft(preferences);
    onReturnToForm?.();
  };

  const saveChanges = async () => {
    const savedSuccessfully = await onSave(draft);
    if (savedSuccessfully) {
      onReturnToForm?.();
    }
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
          <RangeSetting
            label="Tiempo para ofrecer pausa"
            value={draft.eye_rest_trigger_seconds}
            min={4}
            max={30}
            step={1}
            suffix=" s"
            onChange={(value) => update("eye_rest_trigger_seconds", value)}
          />
          <RangeSetting
            label="Duración de la pausa"
            value={draft.eye_rest_pause_seconds}
            min={30}
            max={180}
            step={5}
            suffix=" s"
            onChange={(value) => update("eye_rest_pause_seconds", value)}
          />
        </div>

        <div className="settings-toggles">
          {[
            ["use_pitch_assist", "Usar pitch"],
            ["invert_vertical_axis", "Invertir eje vertical"],
            ["camera_visible", "Mostrar cámara en calibración"],
            ["eye_rest_enabled", "Pausa visual de descanso"],
          ].map(([key, label]) => (
            <label className="toggle-control" key={key}>
              <span>{label}</span>
              <input
                aria-label={label}
                type="checkbox"
                checked={Boolean(draft[key as keyof MiraLinkPreferences])}
                onChange={(event) =>
                  update(
                    key as
                      | "use_pitch_assist"
                      | "invert_vertical_axis"
                      | "camera_visible"
                      | "eye_rest_enabled",
                    event.target.checked,
                  )
                }
              />
            </label>
          ))}
        </div>

        <div className="settings-subsection" aria-label="Lectura en voz alta">
          <h2 className="settings-section-title">Lectura en voz alta</h2>
          <p className="settings-section-lead">
            Lee cada pregunta y opción mientras se muestran. La lectura pausa la
            selección por mirada hasta que termina.
          </p>
          <label className="toggle-control">
            <span>Leer en voz alta</span>
            <input
              aria-label="Leer en voz alta"
              type="checkbox"
              checked={draft.tts_enabled}
              onChange={(event) => update("tts_enabled", event.target.checked)}
            />
          </label>

          {draft.tts_enabled ? (
            <>
              <label className="setting-control setting-control--select">
                <span>Voz</span>
                <select
                  aria-label="Voz"
                  value={draft.tts_voice_id}
                  onChange={(event) => update("tts_voice_id", event.target.value)}
                >
                  <option value="">Automática</option>
                  {Array.from(voicesByEngine.entries()).map(([engine, voices]) => (
                    <optgroup key={engine} label={ENGINE_LABELS[engine] ?? engine}>
                      {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <RangeSetting
                label="Velocidad de voz"
                value={draft.tts_rate}
                min={0.5}
                max={2}
                step={0.1}
                suffix="x"
                onChange={(value) => update("tts_rate", value)}
              />

              {!ttsBrowserSupported ? (
                <p className="inline-message inline-message--error">
                  La voz del navegador no está disponible en este dispositivo.
                  Elige una voz de backend (Piper) o instala voces del sistema.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={cancelChanges}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() => void saveChanges()}
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
