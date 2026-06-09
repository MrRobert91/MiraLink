import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { SettingTooltip } from "./SettingTooltip";
import { answerLabelOptions } from "../lib/answerLabels";
import { selectionSounds } from "../lib/selectionSounds";
import {
  defaultMiraLinkPreferences,
  themeOptions,
  type MiraLinkPreferences,
  type ThemeName,
  type Voice,
} from "../types";

const ENGINE_LABELS: Record<string, string> = {
  piper: "Piper",
  kokoro: "Kokoro",
};

// Textos de ayuda de cada ajuste: qué hace y cuándo subir/bajar o marcarlo.
const TOOLTIPS = {
  provider_mode:
    "Cómo se controla el cursor. «Webcam + MediaPipe» sigue tu mirada con la cámara; «Simulación con puntero» usa el ratón, útil para probar sin cámara.",
  answer_labels:
    "Texto que se muestra en las dos zonas de respuesta. Usa «Verdadero / Falso» si encaja mejor con las preguntas del formulario. Solo cambia las etiquetas, no la lógica.",
  dwell:
    "Tiempo que debes mantener la mirada en una opción para seleccionarla. Súbelo si se hacen selecciones sin querer; bájalo si responder resulta lento.",
  neutral_zone:
    "Ancho de la banda central de descanso donde no se selecciona nada. Súbelo para evitar elecciones accidentales al mirar al centro; bájalo para que las zonas Sí/No sean más grandes.",
  stabilization:
    "Cuánto se suaviza el temblor de la mirada en reposo. Súbelo si el cursor vibra mucho; bájalo si notas demasiado retardo al mover los ojos.",
  horizontal_sensitivity:
    "Cuánto se desplaza el cursor en horizontal respecto al movimiento de tus ojos. Súbelo si no llegas a los bordes laterales; bájalo si te pasas con poco movimiento.",
  vertical_sensitivity:
    "Cuánto se desplaza el cursor en vertical respecto al movimiento de tus ojos. Súbelo si no llegas arriba/abajo; bájalo si el cursor se va demasiado.",
  center_precision:
    "Reduce la sensibilidad cerca del centro para afinar sin perder alcance en los bordes. Súbelo si te cuesta quedarte quieto en el centro; bájalo si el centro responde lento.",
  camera_opacity:
    "Visibilidad de la imagen de la cámara durante la calibración. Súbela para verte mejor al colocarte; bájala si te distrae.",
  eye_rest_trigger:
    "Segundos mirando a la zona de descanso central antes de ofrecer una pausa visual. Súbelo si la pausa aparece demasiado pronto; bájalo para ofrecerla antes.",
  eye_rest_pause:
    "Duración de la pausa visual de descanso una vez aceptada. Súbela para descansar más tiempo la vista.",
  use_pitch_assist:
    "Usa la inclinación vertical de la cabeza para ayudar a estimar la mirada. Actívalo si el eje vertical es impreciso; desactívalo si mueves mucho la cabeza.",
  invert_vertical_axis:
    "Invierte el eje vertical de la mirada. Márcalo solo si al mirar arriba el cursor baja (o viceversa).",
  camera_visible:
    "Muestra tu cámara de fondo durante la calibración para ayudarte a colocarte. Desmárcalo si prefieres una pantalla limpia.",
  eye_rest_enabled:
    "Permite ofrecer una pausa de descanso visual cuando miras al centro un rato. Desmárcalo si no quieres que aparezca.",
  tts_enabled:
    "Lee en voz alta cada pregunta y opción al mostrarse. La lectura congela la selección por mirada hasta que termina, para que puedas escuchar sin elegir sin querer.",
  tts_voice:
    "Voz usada para leer las preguntas. «Automática» usa la voz Piper por defecto. Las voces Piper suenan naturales pero requieren conexión con el backend.",
  tts_rate:
    "Velocidad de la lectura en voz alta. Súbela si la voz va muy lenta; bájala si cuesta entenderla.",
  tts_read_question_once:
    "Lee el enunciado de la pregunta solo en su primera opción; en las siguientes opciones lee únicamente la opción, para agilizar el test.",
  question_intro_enabled:
    "Antes de cada pregunta muestra (y lee, si la voz está activada) una pantalla con el tipo de respuesta y todas las opciones, para que te prepares. Luego pasa al flujo normal de respuesta.",
  question_intro_seconds:
    "Segundos que permanece la pantalla explicativa cuando la voz está desactivada antes de pasar a responder. Con voz, se cierra al terminar la lectura. Siempre puedes adelantarla con el botón «Empezar a responder».",
  selection_sound_enabled:
    "Reproduce un sonido al confirmar la respuesta con la mirada, como aviso de qué se ha elegido (uno para Sí y otro para No).",
  selection_sound_yes: "Sonido que suena al confirmar una respuesta «Sí».",
  selection_sound_no: "Sonido que suena al confirmar una respuesta «No».",
  reading_lock:
    "Cuando la lectura en voz alta está desactivada, bloquea la selección unos segundos al aparecer cada pregunta para darte tiempo a leer sin agobiarte. Al desbloquearse, un pulso del color del tema avisa de que ya puedes responder. 0 lo desactiva.",
} as const;

type SettingsPageProps = {
  preferences: MiraLinkPreferences;
  saving: boolean;
  error: string | null;
  saved: boolean;
  diagnostics?: ReactNode;
  /** Catálogo de voces de backend (Piper/Kokoro) para el selector. */
  ttsVoices?: Voice[];
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
  tooltip?: string;
  onChange: (value: number) => void;
};

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  suffix,
  tooltip,
  onChange,
}: RangeSettingProps) {
  return (
    <label className="setting-control">
      <span>
        <span className="setting-control__label">
          {label}
          {tooltip ? <SettingTooltip label={label} text={tooltip} /> : null}
        </span>
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
  onSave,
  onReturnToForm,
}: SettingsPageProps) {
  const [draft, setDraft] = useState(preferences);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Previsualiza un sonido del catálogo al pulsar ▶ junto a su selector.
  const previewSound = (soundId: string) => {
    const sound = selectionSounds.find((item) => item.id === soundId);
    if (!sound) {
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(sound.src);
    audio.currentTime = 0;
    previewAudioRef.current = audio;
    void audio.play().catch((err) => {
      // Si el navegador bloquea la reproducción o el fichero no carga, lo
      // dejamos visible en consola para poder diagnosticarlo.
      console.warn(`[SelectionSound] No se pudo reproducir ${sound.src}:`, err);
    });
  };

  // Voces agrupadas por motor para el desplegable (Piper / Kokoro / …).
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

  // Restablece los valores por defecto en el borrador. No se persisten hasta que
  // se pulsa «Guardar cambios»: al guardarlos pasan a ser la última configuración.
  const resetToDefaults = () => {
    setDraft((current) => ({
      ...defaultMiraLinkPreferences,
      language: current.language,
    }));
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
          <span className="setting-control__label">
            Modo de entrada
            <SettingTooltip label="Modo de entrada" text={TOOLTIPS.provider_mode} />
          </span>
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

        <label className="setting-control setting-control--select">
          <span className="setting-control__label">
            Tipo de respuesta
            <SettingTooltip label="Tipo de respuesta" text={TOOLTIPS.answer_labels} />
          </span>
          <select
            aria-label="Tipo de respuesta"
            value={draft.answer_labels}
            onChange={(event) =>
              update("answer_labels", event.target.value as MiraLinkPreferences["answer_labels"])
            }
          >
            {answerLabelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
            tooltip={TOOLTIPS.dwell}
            onChange={(value) => update("dwell_ms", value)}
          />
          <RangeSetting
            label="Zona neutra"
            value={draft.neutral_zone_percent}
            min={10}
            max={40}
            step={1}
            suffix="%"
            tooltip={TOOLTIPS.neutral_zone}
            onChange={(value) => update("neutral_zone_percent", value)}
          />
          <RangeSetting
            label="Estabilización"
            value={draft.stabilization}
            min={55}
            max={92}
            step={1}
            suffix="%"
            tooltip={TOOLTIPS.stabilization}
            onChange={(value) => update("stabilization", value)}
          />
          <RangeSetting
            label="Sensibilidad X"
            value={draft.horizontal_sensitivity}
            min={0.8}
            max={4}
            step={0.05}
            suffix="x"
            tooltip={TOOLTIPS.horizontal_sensitivity}
            onChange={(value) => update("horizontal_sensitivity", value)}
          />
          <RangeSetting
            label="Sensibilidad Y"
            value={draft.vertical_sensitivity}
            min={0.8}
            max={4}
            step={0.05}
            suffix="x"
            tooltip={TOOLTIPS.vertical_sensitivity}
            onChange={(value) => update("vertical_sensitivity", value)}
          />
          <RangeSetting
            label="Precisión central"
            value={draft.center_precision}
            min={0}
            max={100}
            step={1}
            suffix="%"
            tooltip={TOOLTIPS.center_precision}
            onChange={(value) => update("center_precision", value)}
          />
          <RangeSetting
            label="Opacidad de la cámara"
            value={draft.camera_opacity}
            min={0}
            max={100}
            step={5}
            suffix="%"
            tooltip={TOOLTIPS.camera_opacity}
            onChange={(value) => update("camera_opacity", value)}
          />
          <RangeSetting
            label="Tiempo para ofrecer pausa"
            value={draft.eye_rest_trigger_seconds}
            min={4}
            max={30}
            step={1}
            suffix=" s"
            tooltip={TOOLTIPS.eye_rest_trigger}
            onChange={(value) => update("eye_rest_trigger_seconds", value)}
          />
          <RangeSetting
            label="Duración de la pausa"
            value={draft.eye_rest_pause_seconds}
            min={30}
            max={180}
            step={5}
            suffix=" s"
            tooltip={TOOLTIPS.eye_rest_pause}
            onChange={(value) => update("eye_rest_pause_seconds", value)}
          />
          <RangeSetting
            label="Bloqueo de lectura"
            value={draft.reading_lock_seconds}
            min={0}
            max={8}
            step={1}
            suffix=" s"
            tooltip={TOOLTIPS.reading_lock}
            onChange={(value) => update("reading_lock_seconds", value)}
          />
        </div>

        <div className="settings-toggles">
          {(
            [
              ["use_pitch_assist", "Usar pitch", TOOLTIPS.use_pitch_assist],
              ["invert_vertical_axis", "Invertir eje vertical", TOOLTIPS.invert_vertical_axis],
              ["camera_visible", "Mostrar cámara en calibración", TOOLTIPS.camera_visible],
              ["eye_rest_enabled", "Pausa visual de descanso", TOOLTIPS.eye_rest_enabled],
            ] as const
          ).map(([key, label, tooltip]) => (
            <label className="toggle-control" key={key}>
              <span className="setting-control__label">
                {label}
                <SettingTooltip label={label} text={tooltip} />
              </span>
              <input
                aria-label={label}
                type="checkbox"
                checked={Boolean(draft[key])}
                onChange={(event) => update(key, event.target.checked)}
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
            <span className="setting-control__label">
              Leer en voz alta
              <SettingTooltip label="Leer en voz alta" text={TOOLTIPS.tts_enabled} />
            </span>
            <input
              aria-label="Leer en voz alta"
              type="checkbox"
              checked={draft.tts_enabled}
              onChange={(event) => update("tts_enabled", event.target.checked)}
            />
          </label>

          <label className="toggle-control">
            <span className="setting-control__label">
              Pantalla explicativa antes de cada pregunta
              <SettingTooltip
                label="Pantalla explicativa antes de cada pregunta"
                text={TOOLTIPS.question_intro_enabled}
              />
            </span>
            <input
              aria-label="Pantalla explicativa antes de cada pregunta"
              type="checkbox"
              checked={draft.question_intro_enabled}
              onChange={(event) => update("question_intro_enabled", event.target.checked)}
            />
          </label>

          {draft.question_intro_enabled ? (
            <RangeSetting
              label="Duración de la pantalla explicativa sin voz"
              value={draft.question_intro_seconds}
              min={2}
              max={15}
              step={1}
              suffix=" s"
              tooltip={TOOLTIPS.question_intro_seconds}
              onChange={(value) => update("question_intro_seconds", value)}
            />
          ) : null}

          {draft.tts_enabled ? (
            <>
              <label className="setting-control setting-control--select">
                <span className="setting-control__label">
                  Voz
                  <SettingTooltip label="Voz" text={TOOLTIPS.tts_voice} />
                </span>
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
                tooltip={TOOLTIPS.tts_rate}
                onChange={(value) => update("tts_rate", value)}
              />

              <label className="toggle-control">
                <span className="setting-control__label">
                  Leer el enunciado solo una vez
                  <SettingTooltip
                    label="Leer el enunciado solo una vez"
                    text={TOOLTIPS.tts_read_question_once}
                  />
                </span>
                <input
                  aria-label="Leer el enunciado solo una vez"
                  type="checkbox"
                  checked={draft.tts_read_question_once}
                  onChange={(event) => update("tts_read_question_once", event.target.checked)}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="settings-subsection" aria-label="Sonido de selección">
          <h2 className="settings-section-title">Sonido de selección</h2>
          <p className="settings-section-lead">
            Reproduce un aviso sonoro al confirmar la respuesta con la mirada: uno para «Sí» y
            otro para «No». Útil como confirmación de lo que se ha elegido.
          </p>
          <label className="toggle-control">
            <span className="setting-control__label">
              Sonido de selección
              <SettingTooltip
                label="Sonido de selección"
                text={TOOLTIPS.selection_sound_enabled}
              />
            </span>
            <input
              aria-label="Sonido de selección"
              type="checkbox"
              checked={draft.selection_sound_enabled}
              onChange={(event) => update("selection_sound_enabled", event.target.checked)}
            />
          </label>

          {draft.selection_sound_enabled ? (
            <>
              {(
                [
                  ["selection_sound_yes", "Sonido para «Sí»", TOOLTIPS.selection_sound_yes],
                  ["selection_sound_no", "Sonido para «No»", TOOLTIPS.selection_sound_no],
                ] as const
              ).map(([key, label, tooltip]) => (
                <label className="setting-control setting-control--select" key={key}>
                  <span className="setting-control__label">
                    {label}
                    <SettingTooltip label={label} text={tooltip} />
                  </span>
                  <span className="setting-control__sound-row">
                    <select
                      aria-label={label}
                      value={draft[key]}
                      onChange={(event) => update(key, event.target.value)}
                    >
                      <option value="">Ninguno</option>
                      {selectionSounds.map((sound) => (
                        <option key={sound.id} value={sound.id}>
                          {sound.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="sound-preview-button"
                      aria-label={`Probar ${label}`}
                      disabled={!draft[key]}
                      onClick={() => previewSound(draft[key])}
                    >
                      ▶
                    </button>
                  </span>
                </label>
              ))}
            </>
          ) : null}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={resetToDefaults}
          >
            Restablecer valores por defecto
          </button>
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
