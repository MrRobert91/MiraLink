import { useEffect, type ReactNode } from "react";

import type { FormQuestion } from "../types";

type QuestionIntroOverlayProps = {
  question: FormQuestion;
  questionIndex: number;
  totalQuestions: number;
  /**
   * Milisegundos antes de cerrar automáticamente. Se usa solo sin voz: con voz,
   * el cierre lo dispara el fin de la locución (onComplete) desde App. 0 = sin
   * temporizador.
   */
  durationMs: number;
  /** Barra de navegación que se muestra encima, igual que al responder. */
  toolbar?: ReactNode;
  onComplete: () => void;
};

/** Etiqueta del tipo de respuesta, compartida entre la vista y la locución. */
export function questionTypeLabel(type: FormQuestion["type"]): string {
  return type === "radio" ? "respuesta única" : "respuesta múltiple";
}

/**
 * Texto de la pantalla explicativa, compartido entre la vista y la locución.
 * Lee el título de la pregunta, su tipo y todas las respuestas posibles.
 * Ej.: "Pregunta 2: ¿Tienes alergias? Respuesta única. Respuestas posibles: Sí, No."
 */
export function questionIntroSpeechText(
  question: FormQuestion,
  questionIndex: number,
): string {
  const options = question.options.map((option) => option.label).join(", ");
  return `Pregunta ${questionIndex + 1}: ${question.title}. ${questionTypeLabel(question.type)}. Respuestas posibles: ${options}.`;
}

/**
 * Clase de la lista de opciones según su número: a partir de 5 se reparten en
 * dos columnas y, por tramos, se reduce el tamaño de letra para que siempre
 * encajen en pantalla sin scroll.
 */
function optionsClassName(count: number): string {
  const classes = ["question-intro__options"];
  if (count >= 5) {
    classes.push("question-intro__options--two-col");
  }
  if (count >= 9) {
    classes.push("question-intro__options--xs");
  } else if (count >= 7) {
    classes.push("question-intro__options--sm");
  }
  return classes.join(" ");
}

export function QuestionIntroOverlay({
  question,
  questionIndex,
  totalQuestions,
  durationMs,
  toolbar,
  onComplete,
}: QuestionIntroOverlayProps) {
  useEffect(() => {
    if (durationMs <= 0) {
      return;
    }
    const timeout = window.setTimeout(onComplete, durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, onComplete]);

  return (
    <div
      className="question-intro-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Presentación de la pregunta"
    >
      {toolbar ? <div className="question-intro__toolbar">{toolbar}</div> : null}
      <div className="question-intro">
        <p className="eyebrow">
          Pregunta {questionIndex + 1} de {totalQuestions}
        </p>
        <p className="question-intro__type">{questionTypeLabel(question.type)}</p>
        <h2 className="question-intro__title">{question.title}</h2>
        <p className="question-intro__lead">Respuestas posibles:</p>
        <ul className={optionsClassName(question.options.length)}>
          {question.options.map((option) => (
            <li key={option.id}>{option.label}</li>
          ))}
        </ul>
        <p className="question-intro__hint">
          Prepárate. En un momento podrás responder con la mirada.
        </p>
        <button type="button" className="primary-button question-intro__start" onClick={onComplete}>
          Empezar a responder
        </button>
      </div>
    </div>
  );
}
