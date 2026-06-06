import { useCallback, useEffect, useState } from "react";
import { exportSubmissionsCsv, getSubmission, getSubmissions } from "../lib/api";
import type { FormAnswerRecord, FormSubmissionDetail, FormSubmissionSummary } from "../types";

type AdminPanelProps = {
  onClose: () => void;
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AnswerDetail({ answers }: { answers: FormAnswerRecord[] }) {
  if (answers.length === 0) {
    return <p className="admin-no-answers">Sin respuestas registradas.</p>;
  }
  return (
    <ul className="admin-answer-list">
      {answers.map((a) => (
        <li key={a.entry_id} className="admin-answer-item">
          <span className="admin-answer-question">{a.question_title}</span>
          <span className="admin-answer-type">({a.question_type})</span>
          <span className="admin-answer-value">
            {a.selected_options.length > 0 ? a.selected_options.join(", ") : <em>Sin respuesta</em>}
          </span>
        </li>
      ))}
    </ul>
  );
}

type RowProps = {
  submission: FormSubmissionSummary;
  selected: boolean;
  onToggle: (id: string) => void;
};

function SubmissionRow({ submission, selected, onToggle }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<FormSubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleExpand = useCallback(async () => {
    if (!expanded && detail == null) {
      setLoadingDetail(true);
      try {
        const data = await getSubmission(submission.id);
        setDetail(data);
      } catch {
        // silently fail — show partial info
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((prev) => !prev);
  }, [expanded, detail, submission.id]);

  return (
    <>
      <tr className={`admin-row${selected ? " admin-row--selected" : ""}`}>
        <td>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(submission.id)}
            aria-label={`Seleccionar envio de ${submission.form_title}`}
          />
        </td>
        <td className="admin-cell-title">{submission.form_title}</td>
        <td>
          <span className={`admin-badge admin-badge--${submission.provider}`}>{submission.provider}</span>
        </td>
        <td>{formatDate(submission.submitted_at)}</td>
        <td>{formatDuration(submission.duration_seconds)}</td>
        <td>{submission.answer_count}</td>
        <td className="admin-cell-actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={handleExpand}>
            {expanded ? "Ocultar" : "Ver respuestas"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => exportSubmissionsCsv([submission.id])}
            title="Exportar este envio como CSV"
          >
            CSV
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="admin-row-detail">
          <td colSpan={7}>
            {loadingDetail ? (
              <p className="admin-loading">Cargando respuestas...</p>
            ) : detail ? (
              <AnswerDetail answers={detail.answers} />
            ) : (
              <p className="admin-loading">No se pudieron cargar las respuestas.</p>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [submissions, setSubmissions] = useState<FormSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterForm, setFilterForm] = useState("");

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSubmissions();
      setSubmissions(data);
    } catch {
      setError("No se pudieron cargar los envios. Comprueba que el backend esta en marcha.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const uniqueForms = Array.from(new Map(submissions.map((s) => [s.form_id, s.form_title])).entries());

  const filtered = filterForm
    ? submissions.filter((s) => s.form_id === filterForm)
    : submissions;

  const allFilteredIds = filtered.map((s) => s.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allSelected, allFilteredIds]);

  const selectedIds = Array.from(selected);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Administracion</p>
          <h2 className="admin-title">Historial de respuestas a formularios</h2>
          <p className="admin-subtitle">
            {submissions.length} envio{submissions.length !== 1 ? "s" : ""} registrado{submissions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn--close" onClick={onClose} aria-label="Cerrar panel">
          ✕ Cerrar
        </button>
      </div>

      <div className="admin-toolbar">
        <select
          className="admin-filter"
          value={filterForm}
          onChange={(e) => setFilterForm(e.target.value)}
          aria-label="Filtrar por formulario"
        >
          <option value="">Todos los formularios</option>
          {uniqueForms.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>

        <div className="admin-toolbar-actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={selectedIds.length === 0}
            onClick={() => exportSubmissionsCsv(selectedIds)}
          >
            Exportar seleccion ({selectedIds.length})
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() =>
              filterForm
                ? exportSubmissionsCsv(filtered.map((s) => s.id))
                : exportSubmissionsCsv()
            }
          >
            {filterForm ? "Exportar este formulario" : "Exportar todos"}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={loadSubmissions}>
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="admin-loading">Cargando envios...</p>
      ) : error ? (
        <p className="admin-error">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="admin-empty">No hay envios registrados todavia.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th>Formulario</th>
                <th>Proveedor</th>
                <th>Enviado el</th>
                <th>Duracion</th>
                <th>Preguntas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <SubmissionRow
                  key={s.id}
                  submission={s}
                  selected={selected.has(s.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
