import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefCallback } from "react";

import { buildDecisionGridColumns, REST_TARGET_ID } from "../lib/decisionZone";
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
  restDwellProgress = 0,
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
  const restElementRef = useRef<HTMLDivElement | null>(null);
  const registerRestRef = registerTarget(REST_TARGET_ID);
  const [restBand, setRestBand] = useState<{ left: number; right: number } | null>(null);

  const setRestNode = useCallback(
    (node: HTMLDivElement | null) => {
      restElementRef.current = node;
      registerRestRef(node);
    },
    [registerRestRef],
  );

  useLayoutEffect(() => {
    const node = restElementRef.current;
    if (!node) {
      setRestBand(null);
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setRestBand((previous) => {
        if (previous && previous.left === rect.left && previous.right === rect.right) {
          return previous;
        }
        return { left: rect.left, right: rect.right };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [neutralZonePercent, step?.questionTitle]);

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
  const overlayStyle: CSSProperties | undefined = restBand
    ? ({
        "--rest-left": `${restBand.left}px`,
        "--rest-right": `${restBand.right}px`,
      } as CSSProperties)
    : undefined;

  return (
    <section className="binary-panel" aria-label="Respuesta binaria">
      {overlayStyle ? (
        <div className="decision-side-overlays" style={overlayStyle} aria-hidden="true">
          <span className={`decision-side-overlay decision-side-overlay--no${noFocused ? " decision-side-overlay--active" : ""}`} />
          <span className={`decision-side-overlay decision-side-overlay--yes${yesFocused ? " decision-side-overlay--active" : ""}`} />
        </div>
      ) : null}
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

        <div ref={setRestNode} className="decision-rest-zone" aria-label="Zona de descanso visual">
          <strong>Descanso</strong>
          <span>Mira al centro para leer sin seleccionar.</span>
          {restDwellProgress > 0 ? (
            <span
              className="decision-rest-zone__rest-ring"
              style={{ "--rest-progress": restDwellProgress } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}
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
