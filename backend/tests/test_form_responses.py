import csv
import io
import sqlite3

from app.services.form_responses import SqliteFormResponseStore


def sample_answers(value: str = "No") -> list[dict]:
    return [
        {
            "entry_id": "q1",
            "question_title": "Quieres descansar?",
            "question_type": "radio",
            "selected_options": [value],
        }
    ]


def test_initialization_migrates_legacy_submissions_table(tmp_path):
    database_path = tmp_path / "responses.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE form_submissions (
                id TEXT PRIMARY KEY,
                form_id TEXT NOT NULL,
                form_title TEXT NOT NULL,
                form_url TEXT NOT NULL,
                provider TEXT NOT NULL,
                submitted_at TEXT NOT NULL,
                duration_seconds REAL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE form_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id TEXT NOT NULL,
                entry_id TEXT NOT NULL,
                question_title TEXT NOT NULL,
                question_type TEXT NOT NULL,
                selected_options TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT INTO form_submissions
                (id, form_id, form_title, form_url, provider, submitted_at, duration_seconds)
            VALUES ('legacy', 'form-1', 'Legacy', 'https://example.com', 'google', '2026-01-01', NULL)
            """
        )

    store = SqliteFormResponseStore(database_path)

    legacy = store.get_submission("legacy")
    assert legacy is not None
    assert legacy["external_status"] == "unknown"
    assert legacy["external_status_code"] is None
    assert legacy["external_message"] is None
    assert legacy["external_attempted_at"] is None


def test_submission_can_be_reused_and_external_status_updated(tmp_path):
    store = SqliteFormResponseStore(tmp_path / "responses.db")

    submission_id = store.record_submission(
        form_id="form-1",
        form_title="Formulario",
        form_url="https://forms.office.com/r/test",
        provider="microsoft",
        duration_seconds=4.5,
        answers=sample_answers(),
    )
    store.update_external_status(
        submission_id,
        status="failed",
        status_code=403,
        message="Microsoft Forms rechazo el envio.",
    )
    reused_id = store.record_submission(
        submission_id=submission_id,
        form_id="form-1",
        form_title="Formulario",
        form_url="https://forms.office.com/r/test",
        provider="microsoft",
        duration_seconds=7.0,
        answers=sample_answers("Si"),
    )

    assert reused_id == submission_id
    assert len(store.list_submissions()) == 1
    detail = store.get_submission(submission_id)
    assert detail is not None
    assert detail["external_status"] == "pending"
    assert detail["external_status_code"] is None
    assert detail["answers"][0]["selected_options"] == ["Si"]


def test_auxiliary_answers_are_stored_and_flagged(tmp_path):
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    submission_id = store.record_submission(
        form_id="form-1",
        form_title="Formulario",
        form_url="https://docs.google.com/forms/d/e/test/viewform",
        provider="google",
        duration_seconds=None,
        answers=[
            {
                "entry_id": "q1",
                "question_title": "Color favorito",
                "question_type": "radio",
                "selected_options": ["Azul"],
            },
            {
                "entry_id": "aux:0",
                "question_title": "¿Estás cómodo?",
                "question_type": "radio",
                "selected_options": ["Sí"],
                "is_auxiliary": True,
            },
        ],
    )

    detail = store.get_submission(submission_id)
    assert detail is not None
    by_title = {a["question_title"]: a for a in detail["answers"]}
    assert by_title["Color favorito"]["is_auxiliary"] is False
    assert by_title["¿Estás cómodo?"]["is_auxiliary"] is True


def test_csv_separates_and_can_exclude_auxiliary_columns(tmp_path):
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    store.record_submission(
        form_id="form-1",
        form_title="Formulario",
        form_url="https://docs.google.com/forms/d/e/test/viewform",
        provider="google",
        duration_seconds=None,
        answers=[
            {
                "entry_id": "q1",
                "question_title": "Color favorito",
                "question_type": "radio",
                "selected_options": ["Azul"],
            },
            {
                "entry_id": "aux:0",
                "question_title": "¿Estás cómodo?",
                "question_type": "radio",
                "selected_options": ["No"],
                "is_auxiliary": True,
            },
        ],
    )

    with_aux = list(csv.DictReader(io.StringIO(store.export_csv())))
    assert "Color favorito" in with_aux[0]
    assert "Auxiliar: ¿Estás cómodo?" in with_aux[0]
    assert with_aux[0]["Auxiliar: ¿Estás cómodo?"] == "No"

    without_aux = list(csv.DictReader(io.StringIO(store.export_csv(include_auxiliary=False))))
    assert "Color favorito" in without_aux[0]
    assert "Auxiliar: ¿Estás cómodo?" not in without_aux[0]


def test_csv_contains_external_delivery_fields(tmp_path):
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    submission_id = store.record_submission(
        form_id="form-1",
        form_title="Formulario",
        form_url="https://docs.google.com/forms/d/e/test/viewform",
        provider="google",
        duration_seconds=None,
        answers=sample_answers(),
    )
    store.update_external_status(
        submission_id,
        status="sent",
        status_code=200,
        message="Formulario enviado.",
    )

    rows = list(csv.DictReader(io.StringIO(store.export_csv())))

    assert rows[0]["external_status"] == "sent"
    assert rows[0]["external_status_code"] == "200"
    assert rows[0]["external_message"] == "Formulario enviado."
    assert rows[0]["external_attempted_at"]
