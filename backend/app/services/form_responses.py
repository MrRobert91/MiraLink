from __future__ import annotations

import csv
import io
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class SqliteFormResponseStore:
    def __init__(self, database_path: Path | str) -> None:
        self._database_path = Path(database_path)
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS form_submissions (
                    id TEXT PRIMARY KEY,
                    form_id TEXT NOT NULL,
                    form_title TEXT NOT NULL,
                    form_url TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    submitted_at TEXT NOT NULL,
                    duration_seconds REAL,
                    external_status TEXT NOT NULL DEFAULT 'unknown',
                    external_status_code INTEGER,
                    external_message TEXT,
                    external_attempted_at TEXT
                );
                CREATE TABLE IF NOT EXISTS form_answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    submission_id TEXT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
                    entry_id TEXT NOT NULL,
                    question_title TEXT NOT NULL,
                    question_type TEXT NOT NULL,
                    selected_options TEXT NOT NULL,
                    is_auxiliary INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_form_answers_submission
                    ON form_answers(submission_id);
                CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id
                    ON form_submissions(form_id);
                CREATE TABLE IF NOT EXISTS saved_forms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    form_id TEXT NOT NULL,
                    form_title TEXT NOT NULL,
                    form_url TEXT NOT NULL UNIQUE,
                    provider TEXT NOT NULL,
                    saved_at TEXT NOT NULL,
                    last_used_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_saved_forms_last_used
                    ON saved_forms(last_used_at DESC);
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(form_submissions)").fetchall()
            }
            migrations = {
                "external_status": "TEXT NOT NULL DEFAULT 'unknown'",
                "external_status_code": "INTEGER",
                "external_message": "TEXT",
                "external_attempted_at": "TEXT",
            }
            for column, definition in migrations.items():
                if column not in columns:
                    connection.execute(
                        f"ALTER TABLE form_submissions ADD COLUMN {column} {definition}"
                    )

            answer_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(form_answers)").fetchall()
            }
            if "is_auxiliary" not in answer_columns:
                connection.execute(
                    "ALTER TABLE form_answers ADD COLUMN is_auxiliary INTEGER NOT NULL DEFAULT 0"
                )

    def record_submission(
        self,
        *,
        submission_id: str | None = None,
        form_id: str,
        form_title: str,
        form_url: str,
        provider: str,
        duration_seconds: float | None,
        answers: list[dict],
    ) -> str:
        submission_id = submission_id or uuid4().hex
        submitted_at = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO form_submissions (
                    id, form_id, form_title, form_url, provider, submitted_at,
                    duration_seconds, external_status, external_status_code,
                    external_message, external_attempted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL)
                ON CONFLICT(id) DO UPDATE SET
                    form_id = excluded.form_id,
                    form_title = excluded.form_title,
                    form_url = excluded.form_url,
                    provider = excluded.provider,
                    duration_seconds = excluded.duration_seconds,
                    external_status = 'pending',
                    external_status_code = NULL,
                    external_message = NULL,
                    external_attempted_at = NULL
                """,
                (submission_id, form_id, form_title, form_url, provider, submitted_at, duration_seconds),
            )
            connection.execute(
                "DELETE FROM form_answers WHERE submission_id = ?",
                (submission_id,),
            )
            for answer in answers:
                connection.execute(
                    """
                    INSERT INTO form_answers (submission_id, entry_id, question_title, question_type, selected_options, is_auxiliary)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        submission_id,
                        answer["entry_id"],
                        answer["question_title"],
                        answer["question_type"],
                        json.dumps(answer["selected_options"], ensure_ascii=False),
                        int(answer.get("is_auxiliary", 0)),
                    ),
                )
        return submission_id

    def update_external_status(
        self,
        submission_id: str,
        *,
        status: str,
        status_code: int | None,
        message: str,
    ) -> None:
        if status not in {"sent", "failed"}:
            raise ValueError(f"Unsupported external status: {status}")
        attempted_at = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE form_submissions
                SET external_status = ?,
                    external_status_code = ?,
                    external_message = ?,
                    external_attempted_at = ?
                WHERE id = ?
                """,
                (status, status_code, message, attempted_at, submission_id),
            )
            if cursor.rowcount != 1:
                raise KeyError(f"Submission not found: {submission_id}")

    def list_submissions(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT s.id, s.form_id, s.form_title, s.form_url, s.provider,
                       s.submitted_at, s.duration_seconds, s.external_status,
                       s.external_status_code, s.external_message,
                       s.external_attempted_at,
                       COUNT(a.id) AS answer_count
                FROM form_submissions s
                LEFT JOIN form_answers a ON a.submission_id = s.id
                GROUP BY s.id
                ORDER BY s.submitted_at DESC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def get_submission(self, submission_id: str) -> dict | None:
        with self._connect() as connection:
            sub = connection.execute(
                "SELECT * FROM form_submissions WHERE id = ?",
                (submission_id,),
            ).fetchone()
            if sub is None:
                return None
            answer_rows = connection.execute(
                """
                SELECT entry_id, question_title, question_type, selected_options, is_auxiliary
                FROM form_answers
                WHERE submission_id = ?
                ORDER BY id
                """,
                (submission_id,),
            ).fetchall()
        answers = [
            {
                "entry_id": row["entry_id"],
                "question_title": row["question_title"],
                "question_type": row["question_type"],
                "selected_options": json.loads(row["selected_options"]),
                "is_auxiliary": bool(row["is_auxiliary"]),
            }
            for row in answer_rows
        ]
        return {**dict(sub), "answers": answers}

    def export_csv(self, ids: list[str] | None = None, include_auxiliary: bool = True) -> str:
        with self._connect() as connection:
            if ids:
                placeholders = ",".join("?" * len(ids))
                subs = connection.execute(
                    f"SELECT * FROM form_submissions WHERE id IN ({placeholders}) ORDER BY submitted_at DESC",
                    ids,
                ).fetchall()
            else:
                subs = connection.execute(
                    "SELECT * FROM form_submissions ORDER BY submitted_at DESC"
                ).fetchall()

            if not subs:
                return ""

            sub_ids = [row["id"] for row in subs]
            placeholders = ",".join("?" * len(sub_ids))
            answer_rows = connection.execute(
                f"""
                SELECT submission_id, entry_id, question_title, question_type, selected_options, is_auxiliary
                FROM form_answers
                WHERE submission_id IN ({placeholders})
                ORDER BY submission_id, id
                """,
                sub_ids,
            ).fetchall()

        answers_by_sub: dict[str, list[dict]] = {}
        for row in answer_rows:
            sid = row["submission_id"]
            answers_by_sub.setdefault(sid, []).append(
                {
                    "entry_id": row["entry_id"],
                    "question_title": row["question_title"],
                    "question_type": row["question_type"],
                    "selected_options": json.loads(row["selected_options"]),
                    "is_auxiliary": bool(row["is_auxiliary"]),
                }
            )

        # Las preguntas del formulario y las auxiliares ocupan columnas separadas.
        # Las auxiliares se prefijan para distinguirlas y solo se incluyen si se pide.
        standard_questions: list[str] = []
        seen_standard: set[str] = set()
        auxiliary_questions: list[str] = []
        seen_auxiliary: set[str] = set()
        for sid in sub_ids:
            for ans in answers_by_sub.get(sid, []):
                key = ans["question_title"]
                if ans["is_auxiliary"]:
                    if key not in seen_auxiliary:
                        seen_auxiliary.add(key)
                        auxiliary_questions.append(key)
                elif key not in seen_standard:
                    seen_standard.add(key)
                    standard_questions.append(key)

        fixed_columns = [
            "id",
            "form_title",
            "form_url",
            "provider",
            "submitted_at",
            "duration_seconds",
            "external_status",
            "external_status_code",
            "external_message",
            "external_attempted_at",
        ]
        aux_columns = auxiliary_questions if include_auxiliary else []
        header = fixed_columns + standard_questions + [f"Auxiliar: {q}" for q in aux_columns]

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(header)

        for sub in subs:
            row_data: list[str] = [
                sub["id"],
                sub["form_title"],
                sub["form_url"],
                sub["provider"],
                sub["submitted_at"],
                str(sub["duration_seconds"]) if sub["duration_seconds"] is not None else "",
                sub["external_status"],
                str(sub["external_status_code"]) if sub["external_status_code"] is not None else "",
                sub["external_message"] or "",
                sub["external_attempted_at"] or "",
            ]
            standard_map = {
                ans["question_title"]: ", ".join(ans["selected_options"])
                for ans in answers_by_sub.get(sub["id"], [])
                if not ans["is_auxiliary"]
            }
            auxiliary_map = {
                ans["question_title"]: ", ".join(ans["selected_options"])
                for ans in answers_by_sub.get(sub["id"], [])
                if ans["is_auxiliary"]
            }
            for q in standard_questions:
                row_data.append(standard_map.get(q, ""))
            for q in aux_columns:
                row_data.append(auxiliary_map.get(q, ""))
            writer.writerow(row_data)

        return output.getvalue()

    def save_form(
        self,
        *,
        form_id: str,
        form_title: str,
        form_url: str,
        provider: str,
    ) -> list[dict]:
        now = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO saved_forms (form_id, form_title, form_url, provider, saved_at, last_used_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(form_url) DO UPDATE SET
                    form_title = excluded.form_title,
                    last_used_at = excluded.last_used_at
                """,
                (form_id, form_title, form_url, provider, now, now),
            )
        return self.list_saved_forms()

    def list_saved_forms(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, form_id, form_title, form_url, provider, saved_at, last_used_at FROM saved_forms ORDER BY last_used_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def delete_saved_form(self, form_url: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM saved_forms WHERE form_url = ?", (form_url,))
