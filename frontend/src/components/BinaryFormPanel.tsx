import type { RefCallback } from "react";

import { DecisionZones } from "./DecisionZones";
import type { DecisionStep, ImportedForm } from "../types";
import type { FormAnswers, FormFlowStatus } from "../lib/formFlow";

type BinaryFormPanelProps = {
  form: ImportedForm | null;
  step: DecisionStep | null;
  answers: FormAnswers;
  status: FormFlowStatus;
  focusedTargetId: string | null;
  dwellProgress: number;
  restDwellProgress?: number;
  neutralZonePercent: number;
  yesLabel: string;
  noLabel: string;
  submitting: boolean;
  submitMessage: string | null;
  registerTarget: (id: string) => RefCallback<HTMLElement>;
  onAnswerYes: () => void;
  onAnswerNo: () => void;
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
  restDwellProgress = 0,
  neutralZonePercent,
  yesLabel,
  noLabel,
  submitting,
  submitMessage,
  registerTarget,
  onAnswerYes,
  onAnswerNo,
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

  return (
    <section className="binary-panel" aria-label="Respuesta binaria">
      <DecisionZones
        header={
          <header className="binary-question">
            <p className="question-type-label">
              {step.questionType === "radio"
                ? "Respuesta única (radio)"
                : "Respuesta múltiple (casillas)"}
            </p>
            <p className="eyebrow">
              Pregunta {step.questionIndex + 1}/{step.totalQuestions} - Opcion {step.optionIndex + 1}/{step.totalOptions}
            </p>
            <h2>{step.questionTitle}</h2>
            <p>{step.optionLabel}</p>
          </header>
        }
        restTitle="Descanso"
        restHint="Mira al centro para leer sin seleccionar."
        yesLabel={yesLabel}
        yesHint="Mirada a la derecha"
        noLabel={noLabel}
        noHint="Mirada a la izquierda"
        focusedTargetId={focusedTargetId}
        dwellProgress={dwellProgress}
        restDwellProgress={restDwellProgress}
        neutralZonePercent={neutralZonePercent}
        registerTarget={registerTarget}
        onAnswerYes={onAnswerYes}
        onAnswerNo={onAnswerNo}
      />
    </section>
  );
}
