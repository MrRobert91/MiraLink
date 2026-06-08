import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  QuestionIntroOverlay,
  questionIntroSpeechText,
  questionTypeLabel,
} from "./QuestionIntroOverlay";
import type { FormQuestion } from "../types";

const radioQuestion: FormQuestion = {
  id: "q1",
  entry_id: "entry.1",
  title: "¿Prefieres café o té?",
  type: "radio",
  options: [
    { id: "o1", label: "Café" },
    { id: "o2", label: "Té" },
  ],
};

const checkboxQuestion: FormQuestion = {
  ...radioQuestion,
  type: "checkbox",
  options: [
    { id: "o1", label: "Pan" },
    { id: "o2", label: "Fruta" },
    { id: "o3", label: "Yogur" },
  ],
};

describe("questionIntroSpeechText", () => {
  it("anuncia número, tipo único y opciones", () => {
    expect(questionIntroSpeechText(radioQuestion, 0)).toBe(
      "Pregunta 1, respuesta única, respuestas posibles: Café, Té.",
    );
  });

  it("anuncia tipo múltiple", () => {
    expect(questionIntroSpeechText(checkboxQuestion, 7)).toBe(
      "Pregunta 8, respuesta múltiple, respuestas posibles: Pan, Fruta, Yogur.",
    );
  });

  it("etiqueta el tipo correctamente", () => {
    expect(questionTypeLabel("radio")).toBe("respuesta única");
    expect(questionTypeLabel("checkbox")).toBe("respuesta múltiple");
  });
});

describe("QuestionIntroOverlay", () => {
  it("muestra el tipo, el título y todas las opciones", () => {
    render(
      <QuestionIntroOverlay
        question={checkboxQuestion}
        questionIndex={0}
        totalQuestions={3}
        durationMs={0}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("respuesta múltiple")).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Pan")).toBeInTheDocument();
    expect(screen.getByText("Fruta")).toBeInTheDocument();
    expect(screen.getByText("Yogur")).toBeInTheDocument();
  });

  it("llama onComplete al expirar el temporizador (sin voz)", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(
        <QuestionIntroOverlay
          question={radioQuestion}
          questionIndex={0}
          totalQuestions={1}
          durationMs={3000}
          onComplete={onComplete}
        />,
      );

      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(onComplete).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("el botón 'Empezar a responder' cierra la pantalla manualmente", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <QuestionIntroOverlay
        question={radioQuestion}
        questionIndex={0}
        totalQuestions={1}
        durationMs={0}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Empezar a responder" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("muestra la barra de navegación pasada por prop", () => {
    render(
      <QuestionIntroOverlay
        question={radioQuestion}
        questionIndex={0}
        totalQuestions={1}
        durationMs={0}
        toolbar={<div data-testid="toolbar" />}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("no programa temporizador con durationMs 0 (modo con voz)", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(
        <QuestionIntroOverlay
          question={radioQuestion}
          questionIndex={0}
          totalQuestions={1}
          durationMs={0}
          onComplete={onComplete}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
