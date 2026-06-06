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
  submission_id: string;
  saved: boolean;
  submitted: boolean;
  status_code: number | null;
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
  external_status: "pending" | "sent" | "failed" | "unknown";
  external_status_code: number | null;
  external_message: string | null;
  external_attempted_at: string | null;
};

export type FormSubmissionDetail = FormSubmissionSummary & {
  answers: FormAnswerRecord[];
};

export type SavedForm = {
  id: number;
  form_id: string;
  form_title: string;
  form_url: string;
  provider: string;
  saved_at: string;
  last_used_at: string;
};

export type ThemeName = "light" | "dark" | "hc-yellow" | "hc-amber" | "hc-mono";

export type ThemeOption = {
  value: ThemeName;
  label: string;
  description: string;
  /** [fondo, acento, texto] para la muestra visual en ajustes. */
  swatch: [string, string, string];
  highContrast: boolean;
};

export const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Claro",
    description: "Fondo blanco, acentos verdes y texto negro. Recomendado.",
    swatch: ["#ffffff", "#0b8457", "#0c1a14"],
    highContrast: false,
  },
  {
    value: "dark",
    label: "Oscuro",
    description: "Fondo verde oscuro y texto claro para entornos con poca luz.",
    swatch: ["#0d1c1f", "#76f1bd", "#f8fbf7"],
    highContrast: false,
  },
  {
    value: "hc-amber",
    label: "Negro sobre amarillo",
    description: "Fondo amarillo intenso con texto negro. Máximo contraste.",
    swatch: ["#ffe600", "#000000", "#000000"],
    highContrast: true,
  },
  {
    value: "hc-yellow",
    label: "Amarillo sobre negro",
    description: "Fondo negro con texto amarillo. Reduce el brillo de pantalla.",
    swatch: ["#000000", "#ffff00", "#ffff00"],
    highContrast: true,
  },
  {
    value: "hc-mono",
    label: "Blanco y negro",
    description: "Solo blanco y negro con bordes marcados. Sin color.",
    swatch: ["#ffffff", "#000000", "#000000"],
    highContrast: true,
  },
];

export type MiraLinkPreferences = {
  language: "es";
  provider_mode: "mediapipe" | "pointer";
  dwell_ms: number;
  neutral_zone_percent: number;
  stabilization: number;
  horizontal_sensitivity: number;
  vertical_sensitivity: number;
  theme: ThemeName;
  high_contrast: boolean;
  use_pitch_assist: boolean;
  invert_vertical_axis: boolean;
};

export const defaultMiraLinkPreferences: MiraLinkPreferences = {
  language: "es",
  provider_mode: "mediapipe",
  dwell_ms: 3000,
  neutral_zone_percent: 24,
  stabilization: 82,
  horizontal_sensitivity: 1.2,
  vertical_sensitivity: 1.2,
  theme: "light",
  high_contrast: false,
  use_pitch_assist: true,
  invert_vertical_axis: false,
};

export type MiraLinkProfile = {
  user_id: string;
  preferences: MiraLinkPreferences;
  quick_phrases: string[];
};
