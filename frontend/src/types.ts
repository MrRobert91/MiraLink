export type GazePoint = {
  x: number;
  y: number;
};

export type HeadPose = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GazeProviderStatus =
  | "idle"
  | "loading"
  | "camera_ready"
  | "tracking"
  | "calibrating"
  | "ready"
  | "degraded"
  | "failed";

export type GazeFeatureVector = {
  leftIrisX: number;
  leftIrisY: number;
  rightIrisX: number;
  rightIrisY: number;
  leftEyeOpen: number;
  rightEyeOpen: number;
  interocularDistance: number;
  faceCenterX: number;
  faceCenterY: number;
  faceWidth: number;
  faceHeight: number;
  yaw: number;
  pitch: number;
  roll: number;
};

export type GazeDiagnostics = {
  landmarksCount: number;
  blink: boolean;
  faceBox?: FaceBox;
};

export type GazeFrame = {
  timestamp: number;
  point: GazePoint | null;
  rawPoint: GazePoint | null;
  confidence: number;
  faceDetected: boolean;
  irisDetected: boolean;
  headPose: HeadPose | null;
  diagnostics: GazeDiagnostics;
  features: GazeFeatureVector | null;
};

export type CalibrationSampleV2 = {
  features: GazeFeatureVector;
  target: GazePoint;
  quality: number;
};

export type RawGazeMappingOptions = {
  horizontalGain: number;
  verticalGain: number;
  yawWeight: number;
  pitchWeight: number;
  usePitchAssist: boolean;
  invertVertical: boolean;
};

export type FormQuestionType = "radio" | "checkbox";

export type FormOption = {
  id: string;
  label: string;
};

export type FormQuestion = {
  id: string;
  entry_id: string;
  title: string;
  type: FormQuestionType;
  options: FormOption[];
};

export type ImportedForm = {
  provider: "google" | "microsoft";
  form_id: string;
  title: string;
  submit_url: string;
  questions: FormQuestion[];
};

export type DecisionStep = {
  id: string;
  questionId: string;
  entryId: string;
  questionTitle: string;
  questionType: FormQuestionType;
  optionId: string;
  optionLabel: string;
  questionIndex: number;
  optionIndex: number;
  totalQuestions: number;
  totalOptions: number;
};

export type GoogleFormSubmitResponse = {
  submitted: boolean;
  status_code: number;
  message: string;
};

export type FormAnswerRecord = {
  entry_id: string;
  question_title: string;
  question_type: FormQuestionType;
  selected_options: string[];
};

export type FormSubmissionSummary = {
  id: string;
  form_id: string;
  form_title: string;
  form_url: string;
  provider: string;
  submitted_at: string;
  duration_seconds: number | null;
  answer_count: number;
};

export type FormSubmissionDetail = FormSubmissionSummary & {
  answers: FormAnswerRecord[];
};
