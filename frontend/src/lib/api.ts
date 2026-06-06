import type { FormSubmissionDetail, FormSubmissionSummary, GoogleFormSubmitResponse, ImportedForm } from "../types";

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

const apiBaseUrl = resolveApiBaseUrl();

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function importGoogleForm(url: string): Promise<ImportedForm> {
  const response = await fetch(buildApiUrl(apiBaseUrl, "/api/forms/import"), {
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

export type SubmitFormPayload = {
  url: string;
  submit_url: string;
  answers: Record<string, string[]>;
  form_id: string;
  form_title: string;
  provider: string;
  questions: FormQuestionMetaPayload[];
  duration_seconds: number | null;
};

export async function submitGoogleForm(payload: SubmitFormPayload): Promise<GoogleFormSubmitResponse> {
  const response = await fetch(buildApiUrl(apiBaseUrl, "/api/forms/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<GoogleFormSubmitResponse>(response);
}

export async function getSubmissions(): Promise<FormSubmissionSummary[]> {
  const response = await fetch(buildApiUrl(apiBaseUrl, "/api/admin/submissions"));
  return parseJson<FormSubmissionSummary[]>(response);
}

export async function getSubmission(id: string): Promise<FormSubmissionDetail> {
  const response = await fetch(buildApiUrl(apiBaseUrl, `/api/admin/submissions/${id}`));
  return parseJson<FormSubmissionDetail>(response);
}

export function exportSubmissionsCsv(ids?: string[]): void {
  const query = ids && ids.length > 0 ? `?ids=${ids.join(",")}` : "";
  const url = buildApiUrl(apiBaseUrl, `/api/admin/submissions/export/csv${query}`);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "respuestas.csv";
  anchor.click();
}
