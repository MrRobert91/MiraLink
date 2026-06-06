import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPanel } from "./AdminPanel";
import { getSubmission, getSubmissions } from "../lib/api";
import type { FormSubmissionSummary } from "../types";

vi.mock("../lib/api", () => ({
  exportSubmissionsCsv: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissions: vi.fn(),
}));

const mockedGetSubmissions = vi.mocked(getSubmissions);
const mockedGetSubmission = vi.mocked(getSubmission);

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
    mockedGetSubmission.mockResolvedValue({
      id: "submission-0",
      form_id: "form-0",
      form_title: "Formulario 0",
      form_url: "https://example.com/form",
      provider: "google",
      submitted_at: "2026-06-06T12:00:00Z",
      duration_seconds: 10,
      answer_count: 1,
      external_status: "sent",
      external_status_code: 200,
      external_message: null,
      external_attempted_at: "2026-06-06T12:00:01Z",
      answers: [
        {
          entry_id: "entry.1",
          question_title: "¿Necesitas agua?",
          question_type: "radio",
          selected_options: ["Sí"],
        },
      ],
    });
  });

  it("shows the external delivery status for every submission", async () => {
    render(<AdminPanel onClose={() => undefined} />);

    expect(await screen.findByText("Enviado")).toBeInTheDocument();
    expect(screen.getByText("Fallido")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Desconocido")).toBeInTheDocument();
  });

  it("renders answer values with semantic emphasis", async () => {
    const user = userEvent.setup();
    render(<AdminPanel onClose={() => undefined} />);

    await user.click(await screen.findAllByRole("button", { name: "Ver respuestas" }).then(
      (buttons) => buttons[0],
    ));

    const answer = await screen.findByText("Sí");
    expect(answer.tagName).toBe("STRONG");
    expect(answer).toHaveClass("admin-answer-value");
  });
});
