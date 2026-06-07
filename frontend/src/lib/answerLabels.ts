import type { AnswerLabelMode } from "../types";

export type AnswerLabels = {
  yes: string;
  no: string;
};

/**
 * Etiquetas visuales para las respuestas binarias. Solo afectan al texto que se
 * muestra (y se lee); la lógica de respuesta sigue siendo Sí/No internamente.
 */
export function getAnswerLabels(mode: AnswerLabelMode): AnswerLabels {
  return mode === "true_false"
    ? { yes: "Verdadero", no: "Falso" }
    : { yes: "Sí", no: "No" };
}

export const answerLabelOptions: { value: AnswerLabelMode; label: string }[] = [
  { value: "si_no", label: "Sí / No" },
  { value: "true_false", label: "Verdadero / Falso" },
];
