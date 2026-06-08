import { useEffect } from "react";

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
  onComplete: () => void;
};

/** Etiqueta del tipo de respuesta, compartida entre la vista y la locución. */
export function questionTypeLabel(type: FormQuestion["type"]): string {
  return type === "radio" ? "respuesta única" : "respuesta múltiple";
}

/**
 * Texto de la pantalla explicativa, compartido entre la vista y la locución.
 * Ej.: "Pregunta 2, respuesta única, respuestas posibles: Sí, No."
 */
export function questionIntroSpeechText(
  question: FormQuestion,
  questionIndex: number,
): string {
  const options = question.options.map((option) => option.label).join(", ");
  return `Pregunta ${questionIndex + 1}, ${questionTypeLabel(question.type)}, respuestas posibles: ${options}.`;
}

export function QuestionIntroOverlay({
  question,
  questionIndex,
  totalQuestions,
  durationMs,
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
      <div className="question-intro">
        <p className="eyebrow">
          Pregunta {questionIndex + 1} de {totalQuestions}
        </p>
        <p className="question-intro__type">{questionTypeLabel(question.type)}</p>
        <h2 className="question-intro__title">{question.title}</h2>
        <p className="question-intro__lead">Respuestas posibles:</p>
        <ul className="question-intro__options">
          {question.options.map((option) => (
            <li key={option.id}>{option.label}</li>
          ))}
        </ul>
        <p className="question-intro__hint">
          Prepárate. En un momento podrás responder con la mirada.
        </p>
      </div>
    </div>
  );
}
