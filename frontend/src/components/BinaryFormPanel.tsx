import type { CSSProperties, RefCallback } from "react";

import { buildDecisionGridColumns } from "../lib/decisionZone";
import type { DecisionStep, ImportedForm } from "../types";
import type { FormAnswers, FormFlowStatus } from "../lib/formFlow";

type BinaryFormPanelProps = {
  form: ImportedForm | null;
  step: DecisionStep | null;
  answers: FormAnswers;
  status: FormFlowStatus;
  focusedTargetId: string | null;
  dwellProgress: number;
  neutralZonePercent: number;
  submitting: boolean;
  submitMessage: string | null;
  registerTarget: (id: string) => RefCallback<HTMLElement>;
  onAnswerYes: () => void;
  onAnswerNo: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onReset: () => void;
};

export function BinaryFormPanel({
  form,
  step,
  answers,
  status,
  focusedTargetId,
  dwellProgress,
  neutralZonePercent,
  submitting,
  submitMessage,
  registerTarget,
  onAnswerYes,
  onAnswerNo,
  onBack,
  onSubmit,
  onReset,
}: BinaryFormPanelProps) {
  if (!form) {
    return (
      <section className="binary-panel binary-panel--empty">
        <p className="eyebrow">Interaccion ocular</p>
        <h2>Importa un formulario para empezar.</h2>
      </section>
    );
  }

  if (status === "review" || status === "submitted") {
    return (
      <section className="binary-panel binary-panel--review">
        <p className="eyebrow">Revision final</p>
        <h2>{form.title}</h2>
        <div className="answer-review-list">
          {form.questions.map((question) => (
            <article key={question.id}>
              <strong>{question.title}</strong>
              <span>{answers[question.entry_id]?.join(", ") || "Sin respuesta seleccionada"}</span>
            </article>
          ))}
        </div>
        <div className="review-actions">
          <button type="button" className="secondary-button" onClick={onBack}>
            Volver
          </button>
          <button type="button" className="secondary-button" onClick={onReset}>
            Nuevo formulario
          </button>
          <button type="button" className="primary-button" onClick={onSubmit} disabled={submitting || status === "submitted"}>
            {submitting ? "Enviando..." : status === "submitted" ? "Enviado" : "Enviar formulario"}
          </button>
        </div>
        {submitMessage ? <p className="submit-message">{submitMessage}</p> : null}
      </section>
    );
  }

  if (!step) {
    return (
      <section className="binary-panel binary-panel--empty">
        <p className="eyebrow">Formulario sin pasos</p>
        <h2>No hay opciones compatibles para responder.</h2>
      </section>
    );
  }

  const noFocused = focusedTargetId === "decision-no";
  const yesFocused = focusedTargetId === "decision-yes";
  const [leftWidth, centerWidth, rightWidth] = buildDecisionGridColumns(neutralZonePercent);
  const gridStyle: CSSProperties = { gridTemplateColumns: `${leftWidth} ${centerWidth} ${rightWidth}` };

  return (
    <section className="binary-panel" aria-label="Respuesta binaria">
      <header className="binary-question">
        <p className="eyebrow">
          Pregunta {step.questionIndex + 1}/{step.totalQuestions} - Opcion {step.optionIndex + 1}/{step.totalOptions}
        </p>
        <h2>{step.questionTitle}</h2>
        <p>{step.optionLabel}</p>
      </header>

      <div className="binary-decision-grid" style={gridStyle}>
        <button
          ref={registerTarget("decision-no")}
          type="button"
          className={`decision-zone decision-zone--no${noFocused ? " decision-zone--focused" : ""}`}
          onClick={onAnswerNo}
        >
          <span>No</span>
          <small>Mirada a la izquierda</small>
          {noFocused ? <span className="decision-zone__progress" style={{ transform: `scaleX(${dwellProgress})` }} /> : null}
        </button>

        <div className="decision-rest-zone" aria-label="Zona de descanso visual">
          <strong>Descanso</strong>
          <span>Mira al centro para leer sin seleccionar.</span>
        </div>

        <button
          ref={registerTarget("decision-yes")}
          type="button"
          className={`decision-zone decision-zone--yes${yesFocused ? " decision-zone--focused" : ""}`}
          onClick={onAnswerYes}
        >
          <span>Si</span>
          <small>Mirada a la derecha</small>
          {yesFocused ? <span className="decision-zone__progress" style={{ transform: `scaleX(${dwellProgress})` }} /> : null}
        </button>
      </div>
    </section>
  );
}
