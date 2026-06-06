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
                    duration_seconds REAL
                );
                CREATE TABLE IF NOT EXISTS form_answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    submission_id TEXT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
                    entry_id TEXT NOT NULL,
                    question_title TEXT NOT NULL,
                    question_type TEXT NOT NULL,
                    selected_options TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_form_answers_submission
                    ON form_answers(submission_id);
                CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id
                    ON form_submissions(form_id);
                """
            )

    def record_submission(
        self,
        *,
        form_id: str,
        form_title: str,
        form_url: str,
        provider: str,
        duration_seconds: float | None,
        answers: list[dict],
    ) -> str:
        submission_id = uuid4().hex
        submitted_at = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO form_submissions (id, form_id, form_title, form_url, provider, submitted_at, duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (submission_id, form_id, form_title, form_url, provider, submitted_at, duration_seconds),
            )
            for answer in answers:
                connection.execute(
                    """
                    INSERT INTO form_answers (submission_id, entry_id, question_title, question_type, selected_options)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        submission_id,
                        answer["entry_id"],
                        answer["question_title"],
                        answer["question_type"],
                        json.dumps(answer["selected_options"], ensure_ascii=False),
                    ),
                )
        return submission_id

    def list_submissions(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT s.id, s.form_id, s.form_title, s.form_url, s.provider,
                       s.submitted_at, s.duration_seconds,
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
                SELECT entry_id, question_title, question_type, selected_options
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
            }
            for row in answer_rows
        ]
        return {**dict(sub), "answers": answers}

    def export_csv(self, ids: list[str] | None = None) -> str:
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
                SELECT submission_id, entry_id, question_title, question_type, selected_options
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
                }
            )

        all_questions: list[str] = []
        seen_questions: set[str] = set()
        for sid in sub_ids:
            for ans in answers_by_sub.get(sid, []):
                key = ans["question_title"]
                if key not in seen_questions:
                    seen_questions.add(key)
                    all_questions.append(key)

        fixed_columns = ["id", "form_title", "form_url", "provider", "submitted_at", "duration_seconds"]
        header = fixed_columns + all_questions

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
            ]
            answers_map = {ans["question_title"]: ", ".join(ans["selected_options"]) for ans in answers_by_sub.get(sub["id"], [])}
            for q in all_questions:
                row_data.append(answers_map.get(q, ""))
            writer.writerow(row_data)

        return output.getvalue()
