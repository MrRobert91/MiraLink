type SettingTooltipProps = {
  /** Texto explicativo: qué hace el ajuste y cuándo subir/bajar o marcarlo. */
  text: string;
  /** Etiqueta del ajuste, para construir un aria-label descriptivo. */
  label: string;
};

/**
 * Icono ⓘ que muestra una explicación al pasar el ratón o enfocar con teclado.
 * La burbuja se posiciona con CSS y es accesible (role="tooltip").
 */
export function SettingTooltip({ text, label }: SettingTooltipProps) {
  return (
    <span className="setting-tooltip">
      <button
        type="button"
        className="setting-tooltip__icon"
        aria-label={`Ayuda: ${label}`}
      >
        ⓘ
      </button>
      <span className="setting-tooltip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
