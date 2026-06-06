import { buildDecisionSteps, createInitialFormFlowState, formFlowReducer } from "./formFlow";
import type { ImportedForm } from "../types";

const sampleForm: ImportedForm = {
  provider: "google",
  form_id: "abc123",
  title: "Cuestionario diario",
  submit_url: "https://docs.google.com/forms/d/e/abc123/formResponse",
  questions: [
    {
      id: "q1",
      entry_id: "entry.111",
      title: "Como te encuentras?",
      type: "checkbox",
      options: [
        { id: "q1-a", label: "Tengo sed" },
        { id: "q1-b", label: "Tengo frio" },
      ],
    },
    {
      id: "q2",
      entry_id: "entry.222",
      title: "Quieres descansar?",
      type: "radio",
      options: [
        { id: "q2-a", label: "Si" },
        { id: "q2-b", label: "No" },
      ],
    },
  ],
};

describe("form flow", () => {
  it("builds one binary decision step per form option", () => {
    const steps = buildDecisionSteps(sampleForm);

    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatchObject({
      questionId: "q1",
      optionId: "q1-a",
      questionTitle: "Como te encuentras?",
      optionLabel: "Tengo sed",
      questionType: "checkbox",
    });
    expect(steps[3].optionLabel).toBe("No");
  });

  it("records checkbox yes answers and skips no answers", () => {
    let state = formFlowReducer(createInitialFormFlowState(), { type: "loadForm", form: sampleForm });
    state = formFlowReducer(state, { type: "openCalibrationChoice" });
    state = formFlowReducer(state, { type: "skipCalibration" });
    state = formFlowReducer(state, { type: "startAnswering" });

    state = formFlowReducer(state, { type: "answerYes" });
    state = formFlowReducer(state, { type: "answerNo" });

    expect(state.currentStepIndex).toBe(2);
    expect(state.answers["entry.111"]).toEqual(["Tengo sed"]);
  });

  it("keeps only the selected radio answer and advances to review after the last step", () => {
    let state = formFlowReducer(createInitialFormFlowState(), { type: "loadForm", form: sampleForm });
    state = formFlowReducer(state, { type: "openCalibrationChoice" });
    state = formFlowReducer(state, { type: "skipCalibration" });
    state = formFlowReducer(state, { type: "startAnswering" });

    state = formFlowReducer(state, { type: "answerNo" });
    state = formFlowReducer(state, { type: "answerNo" });
    state = formFlowReducer(state, { type: "answerYes" });

    expect(state.status).toBe("review");
    expect(state.answers["entry.222"]).toEqual(["Si"]);
  });

  it("skips the remaining radio options after the first yes", () => {
    let state = formFlowReducer(createInitialFormFlowState(), { type: "loadForm", form: sampleForm });
    state = formFlowReducer(state, { type: "openCalibrationChoice" });
    state = formFlowReducer(state, { type: "skipCalibration" });
    state = formFlowReducer(state, { type: "startAnswering" });

    state = formFlowReducer(state, { type: "answerNo" });
    state = formFlowReducer(state, { type: "answerNo" });
    state = formFlowReducer(state, { type: "answerYes" });

    expect(state.currentStepIndex).toBe(4);
    expect(state.status).toBe("review");
    expect(state.answers["entry.222"]).toEqual(["Si"]);
  });

  it("moves through preparation states before answering", () => {
    let state = formFlowReducer(createInitialFormFlowState(), { type: "loadForm", form: sampleForm });
    expect(state.status).toBe("formLoaded");

    state = formFlowReducer(state, { type: "openCalibrationChoice" });
    expect(state.status).toBe("calibrationChoice");

    state = formFlowReducer(state, { type: "startCalibration" });
    expect(state.status).toBe("calibrating");

    state = formFlowReducer(state, { type: "completeCalibration" });
    expect(state.status).toBe("ready");

    state = formFlowReducer(state, { type: "startAnswering" });
    expect(state.status).toBe("answering");
  });

  it("can prepare without calibration and pause without losing progress", () => {
    let state = formFlowReducer(createInitialFormFlowState(), { type: "loadForm", form: sampleForm });
    state = formFlowReducer(state, { type: "openCalibrationChoice" });
    state = formFlowReducer(state, { type: "skipCalibration" });
    state = formFlowReducer(state, { type: "startAnswering" });
    state = formFlowReducer(state, { type: "answerYes" });
    state = formFlowReducer(state, { type: "pauseAnswering" });

    expect(state.status).toBe("ready");
    expect(state.currentStepIndex).toBe(1);
    expect(state.answers["entry.111"]).toEqual(["Tengo sed"]);
  });
});
