import type { GoogleFormSubmitResponse, ImportedForm } from "../types";

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

export async function submitGoogleForm(url: string, submitUrl: string, answers: Record<string, string[]>): Promise<GoogleFormSubmitResponse> {
  const response = await fetch(buildApiUrl(apiBaseUrl, "/api/forms/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, submit_url: submitUrl, answers }),
  });
  return parseJson<GoogleFormSubmitResponse>(response);
}
