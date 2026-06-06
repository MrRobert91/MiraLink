import type { DecisionStep, ImportedForm } from "../types";

export type FormFlowStatus =
  | "idle"
  | "formLoaded"
  | "calibrationChoice"
  | "calibrating"
  | "ready"
  | "answering"
  | "review"
  | "submitted";

export type FormAnswers = Record<string, string[]>;

export type FormFlowState = {
  form: ImportedForm | null;
  steps: DecisionStep[];
  currentStepIndex: number;
  answers: FormAnswers;
  status: FormFlowStatus;
};

export type FormFlowAction =
  | { type: "loadForm"; form: ImportedForm }
  | { type: "openCalibrationChoice" }
  | { type: "startCalibration" }
  | { type: "completeCalibration" }
  | { type: "skipCalibration" }
  | { type: "startAnswering" }
  | { type: "pauseAnswering" }
  | { type: "answerYes" }
  | { type: "answerNo" }
  | { type: "goBack" }
  | { type: "reset" }
  | { type: "markSubmitted" };

export function buildDecisionSteps(form: ImportedForm): DecisionStep[] {
  return form.questions.flatMap((question, questionIndex) =>
    question.options.map((option, optionIndex) => ({
      id: `${question.id}:${option.id}`,
      questionId: question.id,
      entryId: question.entry_id,
      questionTitle: question.title,
      questionType: question.type,
      optionId: option.id,
      optionLabel: option.label,
      questionIndex,
      optionIndex,
      totalQuestions: form.questions.length,
      totalOptions: question.options.length,
    })),
  );
}

export function createInitialFormFlowState(): FormFlowState {
  return {
    form: null,
    steps: [],
    currentStepIndex: 0,
    answers: {},
    status: "idle",
  };
}

function advance(state: FormFlowState): FormFlowState {
  const nextIndex = state.currentStepIndex + 1;
  if (nextIndex >= state.steps.length) {
    return { ...state, currentStepIndex: state.steps.length, status: "review" };
  }

  return { ...state, currentStepIndex: nextIndex };
}

function advancePastRadioQuestion(state: FormFlowState, questionId: string): FormFlowState {
  const nextIndex = state.steps.findIndex(
    (step, index) => index > state.currentStepIndex && step.questionId !== questionId,
  );

  if (nextIndex === -1) {
    return { ...state, currentStepIndex: state.steps.length, status: "review" };
  }

  return { ...state, currentStepIndex: nextIndex };
}

function recordYesAndAdvance(state: FormFlowState): FormFlowState {
  const step = state.steps[state.currentStepIndex];
  if (!step || state.status !== "answering") {
    return state;
  }

  const currentAnswers = state.answers[step.entryId] ?? [];
  const nextQuestionAnswers =
    step.questionType === "radio"
      ? [step.optionLabel]
      : Array.from(new Set([...currentAnswers, step.optionLabel]));

  const nextState = {
    ...state,
    answers: {
      ...state.answers,
      [step.entryId]: nextQuestionAnswers,
    },
  };

  return step.questionType === "radio" ? advancePastRadioQuestion(nextState, step.questionId) : advance(nextState);
}

export function formFlowReducer(state: FormFlowState, action: FormFlowAction): FormFlowState {
  switch (action.type) {
    case "loadForm": {
      const steps = buildDecisionSteps(action.form);
      return {
        form: action.form,
        steps,
        currentStepIndex: 0,
        answers: {},
        status: steps.length > 0 ? "formLoaded" : "review",
      };
    }
    case "openCalibrationChoice":
      return state.status === "formLoaded"
        ? { ...state, status: "calibrationChoice" }
        : state;
    case "startCalibration":
      return state.status === "calibrationChoice"
        ? { ...state, status: "calibrating" }
        : state;
    case "completeCalibration":
      return state.status === "calibrating"
        ? { ...state, status: "ready" }
        : state;
    case "skipCalibration":
      return state.status === "calibrationChoice" || state.status === "calibrating"
        ? { ...state, status: "ready" }
        : state;
    case "startAnswering":
      return state.status === "ready"
        ? { ...state, status: "answering" }
        : state;
    case "pauseAnswering":
      return state.status === "answering"
        ? { ...state, status: "ready" }
        : state;
    case "answerYes":
      return recordYesAndAdvance(state);
    case "answerNo":
      return state.status === "answering" ? advance(state) : state;
    case "goBack":
      if (state.status === "idle") {
        return state;
      }
      return {
        ...state,
        status: "answering",
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
      };
    case "markSubmitted":
      return { ...state, status: "submitted" };
    case "reset":
      return createInitialFormFlowState();
    default:
      return state;
  }
}
