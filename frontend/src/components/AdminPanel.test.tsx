import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPanel } from "./AdminPanel";
import { getSubmissions } from "../lib/api";
import type { FormSubmissionSummary } from "../types";

vi.mock("../lib/api", () => ({
  exportSubmissionsCsv: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissions: vi.fn(),
}));

const mockedGetSubmissions = vi.mocked(getSubmissions);

describe("AdminPanel", () => {
  beforeEach(() => {
    const statuses: FormSubmissionSummary["external_status"][] = [
      "sent",
      "failed",
      "pending",
      "unknown",
    ];
    mockedGetSubmissions.mockResolvedValue(
      statuses.map((external_status, index) => ({
        id: `submission-${index}`,
        form_id: `form-${index}`,
        form_title: `Formulario ${index}`,
        form_url: "https://example.com/form",
        provider: "google",
        submitted_at: "2026-06-06T12:00:00Z",
        duration_seconds: 10,
        answer_count: 1,
        external_status,
        external_status_code: null,
        external_message: null,
        external_attempted_at: null,
      })),
    );
  });

  it("shows the external delivery status for every submission", async () => {
    render(<AdminPanel onClose={() => undefined} />);

    expect(await screen.findByText("Enviado")).toBeInTheDocument();
    expect(screen.getByText("Fallido")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Desconocido")).toBeInTheDocument();
  });
});
