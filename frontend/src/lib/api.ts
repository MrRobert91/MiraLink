import type {
  FormSubmissionDetail,
  FormSubmissionSummary,
  GoogleFormSubmitResponse,
  ImportedForm,
  MiraLinkPreferences,
  MiraLinkProfile,
  SavedForm,
  Voice,
} from "../types";

type RuntimeAppConfig = {
  VITE_API_BASE_URL?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeAppConfig;
  }
}

function resolveApiBaseUrl(): string {
  const runtimeBaseUrl =
    typeof window !== "undefined" ? window.__APP_CONFIG__?.VITE_API_BASE_URL?.trim() ?? "" : "";

  return runtimeBaseUrl || (import.meta.env.VITE_API_BASE_URL ?? "").trim();
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedBaseUrl) {
    throw new Error("VITE_API_BASE_URL no esta configurado.");
  }

  return `${normalizedBaseUrl}${normalizedPath}`;
}

const miralinkProfileId = "miralink-default";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // ignore parse error, keep generic message
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function importGoogleForm(url: string): Promise<ImportedForm> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/forms/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return parseJson<ImportedForm>(response);
}

export type FormQuestionMetaPayload = {
  entry_id: string;
  title: string;
  type: string;
};

export type AuxiliaryAnswerPayload = {
  question_title: string;
  selected_options: string[];
};

export type SubmitFormPayload = {
  submission_id?: string;
  url: string;
  submit_url: string;
  answers: Record<string, string[]>;
  form_id: string;
  form_title: string;
  provider: string;
  questions: FormQuestionMetaPayload[];
  duration_seconds: number | null;
  auxiliary_answers?: AuxiliaryAnswerPayload[];
};

export async function submitGoogleForm(payload: SubmitFormPayload): Promise<GoogleFormSubmitResponse> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/forms/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<GoogleFormSubmitResponse>(response);
}

export async function getSubmissions(): Promise<FormSubmissionSummary[]> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/admin/submissions"));
  return parseJson<FormSubmissionSummary[]>(response);
}

export async function getSubmission(id: string): Promise<FormSubmissionDetail> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), `/api/admin/submissions/${id}`));
  return parseJson<FormSubmissionDetail>(response);
}

export function exportSubmissionsCsv(ids?: string[], includeAuxiliary = true): void {
  const params = new URLSearchParams();
  if (ids && ids.length > 0) {
    params.set("ids", ids.join(","));
  }
  if (!includeAuxiliary) {
    params.set("include_auxiliary", "false");
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const url = buildApiUrl(resolveApiBaseUrl(), `/api/admin/submissions/export/csv${query}`);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "respuestas.csv";
  anchor.click();
}

export type SaveFormPayload = {
  form_id: string;
  form_title: string;
  form_url: string;
  provider: string;
};

export async function getSavedForms(): Promise<SavedForm[]> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/forms/saved"));
  return parseJson<SavedForm[]>(response);
}

export async function saveForm(payload: SaveFormPayload): Promise<SavedForm[]> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/forms/saved"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<SavedForm[]>(response);
}

export async function deleteSavedForm(url: string): Promise<void> {
  const response = await fetch(
    buildApiUrl(resolveApiBaseUrl(), `/api/forms/saved?url=${encodeURIComponent(url)}`),
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Error ${response.status}`);
}

export async function fetchBackendVoices(): Promise<Voice[]> {
  const response = await fetch(buildApiUrl(resolveApiBaseUrl(), "/api/tts/voices"));
  return parseJson<Voice[]>(response);
}

export type TtsPrepareItem = { key: string; text: string };

/**
 * Pide al backend que genere (o reutilice del caché) los audios de un
 * formulario y devuelve un mapa `key -> URL absoluta` lista para <audio>.
 */
export async function prepareFormAudio(
  formId: string,
  voiceId: string,
  items: TtsPrepareItem[],
): Promise<Record<string, string>> {
  const base = resolveApiBaseUrl();
  const response = await fetch(buildApiUrl(base, "/api/tts/prepare"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form_id: formId, voice_id: voiceId, items }),
  });
  const data = await parseJson<{ voice_id: string; items: Record<string, string> }>(response);
  const absolute: Record<string, string> = {};
  for (const [key, relativeUrl] of Object.entries(data.items)) {
    absolute[key] = buildApiUrl(base, relativeUrl);
  }
  return absolute;
}

export async function getProfile(): Promise<MiraLinkProfile> {
  const response = await fetch(
    buildApiUrl(resolveApiBaseUrl(), `/api/profiles/${miralinkProfileId}`),
  );
  return parseJson<MiraLinkProfile>(response);
}

export async function updateProfile(
  preferences: MiraLinkPreferences,
): Promise<MiraLinkProfile> {
  const response = await fetch(
    buildApiUrl(resolveApiBaseUrl(), `/api/profiles/${miralinkProfileId}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    },
  );
  return parseJson<MiraLinkProfile>(response);
}
