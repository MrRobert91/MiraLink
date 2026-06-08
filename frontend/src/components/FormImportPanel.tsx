import { useEffect, useRef, useState } from "react";

import type { SavedForm } from "../types";

type FormImportPanelProps = {
  formUrl: string;
  importing: boolean;
  error: string | null;
  savedForms: SavedForm[];
  onUrlChange: (url: string) => void;
  onImport: () => void;
  onLoadSaved: (url: string) => void;
  onDeleteSaved: (url: string) => void;
};

export function FormImportPanel({ formUrl, importing, error, savedForms, onUrlChange, onImport, onLoadSaved, onDeleteSaved }: FormImportPanelProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDropdown]);

  return (
    <section className="form-import-panel">
      <div>
        <p className="eyebrow">Formulario</p>
        <h2>Pega la URL pública de tu Microsoft Forms</h2>
        <p>
          La aplicacion importara preguntas de opcion multiple o casillas y las convertira en decisiones binarias:
          mirar izquierda para No, derecha para Si.
        </p>
      </div>
      <div className="form-import-panel__controls">
        <input
          type="url"
          value={formUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://forms.office.com/r/..."
          aria-label="URL de formulario"
        />
        <button type="button" className="primary-button" onClick={onImport} disabled={importing || formUrl.trim().length === 0}>
          {importing ? "Importando..." : "Importar formulario"}
        </button>
        <div className="saved-forms-trigger" ref={triggerRef}>
          <button
            type="button"
            className="secondary-button saved-forms-btn"
            onClick={() => setShowDropdown((prev) => !prev)}
            aria-expanded={showDropdown}
            aria-label="Cargar formulario guardado"
          >
            Cargar formulario {showDropdown ? "▲" : "▼"}
          </button>
          {showDropdown && (
            <div className="saved-forms-dropdown" role="menu">
              {savedForms.length === 0 ? (
                <p className="saved-forms-empty">No hay formularios guardados.</p>
              ) : (
                <ul className="saved-forms-list">
                  {savedForms.map((sf) => (
                    <li key={sf.form_url} className="saved-forms-item">
                      <div className="saved-forms-info">
                        <span className="saved-forms-title">{sf.form_title}</span>
                        <span className={`admin-badge admin-badge--${sf.provider}`}>{sf.provider}</span>
                      </div>
                      <div className="saved-forms-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          onClick={() => { onLoadSaved(sf.form_url); setShowDropdown(false); }}
                        >
                          Cargar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          aria-label={`Eliminar ${sf.form_title}`}
                          onClick={() => onDeleteSaved(sf.form_url)}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      {error ? <p className="form-import-panel__error">{error}</p> : null}
    </section>
  );
}
