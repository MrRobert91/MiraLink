import { render, screen } from "@testing-library/react";

import type { DecisionStep, ImportedForm } from "../types";
import { BinaryFormPanel } from "./BinaryFormPanel";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const form: ImportedForm = {
  provider: "google",
  form_id: "form-1",
  title: "Formulario",
  submit_url: "https://example.com/submit",
  questions: [],
};

function renderPanel(step: DecisionStep) {
  return render(
    <BinaryFormPanel
      form={form}
      step={step}
      answers={{}}
      status="answering"
      focusedTargetId={null}
      dwellProgress={0}
      neutralZonePercent={24}
      yesLabel="Sí"
      noLabel="No"
      submitting={false}
      submitMessage={null}
      registerTarget={() => () => undefined}
      onAnswerYes={() => undefined}
      onAnswerNo={() => undefined}
      onSubmit={() => undefined}
      onReset={() => undefined}
    />,
  );
}

const baseStep: DecisionStep = {
  id: "q1:o1",
  questionId: "q1",
  entryId: "entry.1",
  questionTitle: "¿Qué necesitas?",
  questionType: "radio",
  optionId: "o1",
  optionLabel: "Agua",
  questionIndex: 0,
  optionIndex: 0,
  totalQuestions: 1,
  totalOptions: 2,
};

describe("BinaryFormPanel", () => {
  it("labels radio questions as single response", () => {
    renderPanel(baseStep);

    expect(screen.getByText("Respuesta única (radio)")).toBeInTheDocument();
  });

  it("labels checkbox questions as multiple response", () => {
    renderPanel({ ...baseStep, questionType: "checkbox" });

    expect(screen.getByText("Respuesta múltiple (casillas)")).toBeInTheDocument();
  });
});
