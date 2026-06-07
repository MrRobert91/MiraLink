from fastapi.testclient import TestClient

from app.main import create_app
from app.services.form_responses import SqliteFormResponseStore
from app.services.google_forms import (
    GoogleFormError,
    ImportedGoogleForm,
)


def test_profile_endpoint_persists_preferences():
    client = TestClient(create_app())
    user_id = "demo-profile-test"

    update_response = client.put(
        f"/api/profiles/{user_id}",
        json={"language": "es", "dwell_ms": 950, "high_contrast": True},
    )
    assert update_response.status_code == 200

    read_response = client.get(f"/api/profiles/{user_id}")
    assert read_response.status_code == 200
    payload = read_response.json()
    assert payload["preferences"]["dwell_ms"] == 950
    assert payload["preferences"]["high_contrast"] is True


def test_generic_forms_import_endpoint_routes_by_url(monkeypatch):
    form = ImportedGoogleForm(
        form_id="abc123",
        title="Cuestionario diario",
        submit_url="https://docs.google.com/forms/d/e/abc123/formResponse",
        questions=[],
    )
    monkeypatch.setattr("app.main.import_external_form", lambda url: form)
    client = TestClient(create_app())

    response = client.post("/api/forms/import", json={"url": "https://forms.office.com/r/abc123"})

    assert response.status_code == 200
    assert response.json()["title"] == "Cuestionario diario"


def test_generic_forms_submit_endpoint_saves_and_marks_success(monkeypatch, tmp_path):
    monkeypatch.setattr("app.main.submit_external_form", lambda url, submit_url, answers: {"submitted": True, "status_code": 200, "message": "Formulario enviado."})
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(response_store=store))

    response = client.post(
        "/api/forms/submit",
        json={
            "url": "https://forms.office.com/r/abc123",
            "submit_url": "https://forms.office.com/api/submit",
            "answers": {"q1": ["No"]},
            "form_id": "abc123",
            "form_title": "Formulario",
            "provider": "microsoft",
            "questions": [{"entry_id": "q1", "title": "Respuesta", "type": "radio"}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["saved"] is True
    assert payload["submitted"] is True
    assert store.get_submission(payload["submission_id"])["external_status"] == "sent"


def test_auxiliary_answers_are_saved_but_not_sent_to_provider(monkeypatch, tmp_path):
    sent_answers: dict = {}

    def capture(url, submit_url, answers):
        sent_answers.update(answers)
        return {"submitted": True, "status_code": 200, "message": "Formulario enviado."}

    monkeypatch.setattr("app.main.submit_external_form", capture)
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(response_store=store))

    response = client.post(
        "/api/forms/submit",
        json={
            "url": "https://forms.office.com/r/abc123",
            "submit_url": "https://forms.office.com/api/submit",
            "answers": {"q1": ["No"]},
            "questions": [{"entry_id": "q1", "title": "Respuesta", "type": "radio"}],
            "auxiliary_answers": [
                {"question_title": "¿Estás cómodo?", "selected_options": ["Sí"]},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    # La pregunta auxiliar nunca llega al proveedor externo.
    assert set(sent_answers.keys()) == {"q1"}

    detail = store.get_submission(payload["submission_id"])
    by_title = {a["question_title"]: a for a in detail["answers"]}
    assert by_title["Respuesta"]["is_auxiliary"] is False
    assert by_title["¿Estás cómodo?"]["is_auxiliary"] is True
    assert by_title["¿Estás cómodo?"]["selected_options"] == ["Sí"]


def test_generic_forms_submit_endpoint_saves_provider_rejection(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "app.main.submit_external_form",
        lambda url, submit_url, answers: {
            "submitted": False,
            "status_code": 403,
            "message": "Microsoft Forms rechazo el envio.",
        },
    )
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(response_store=store))

    response = client.post(
        "/api/forms/submit",
        json={
            "url": "https://forms.office.com/r/abc123",
            "answers": {"q1": ["No"]},
            "questions": [{"entry_id": "q1", "title": "Respuesta", "type": "radio"}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["saved"] is True
    assert payload["submitted"] is False
    assert store.get_submission(payload["submission_id"])["external_status"] == "failed"


def test_generic_forms_submit_endpoint_saves_transport_failure(monkeypatch, tmp_path):
    def fail(*args):
        raise GoogleFormError("No hay endpoint publico.")

    monkeypatch.setattr("app.main.submit_external_form", fail)
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(response_store=store))

    response = client.post(
        "/api/forms/submit",
        json={
            "url": "https://forms.office.com/r/abc123",
            "answers": {"q1": ["No"]},
            "questions": [{"entry_id": "q1", "title": "Respuesta", "type": "radio"}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["saved"] is True
    assert payload["submitted"] is False
    assert "guardadas" in payload["message"].lower()
    assert store.get_submission(payload["submission_id"])["external_status"] == "failed"


def test_generic_forms_submit_retry_updates_same_submission(monkeypatch, tmp_path):
    results = iter(
        [
            {"submitted": False, "status_code": 503, "message": "No disponible."},
            {"submitted": True, "status_code": 200, "message": "Formulario enviado."},
        ]
    )
    monkeypatch.setattr("app.main.submit_external_form", lambda *args: next(results))
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(response_store=store))
    request = {
        "url": "https://docs.google.com/forms/d/e/abc123/viewform",
        "submit_url": "https://docs.google.com/forms/d/e/abc123/formResponse",
        "answers": {"q1": ["No"]},
        "questions": [{"entry_id": "q1", "title": "Respuesta", "type": "radio"}],
    }

    first = client.post("/api/forms/submit", json=request).json()
    second = client.post(
        "/api/forms/submit",
        json={**request, "submission_id": first["submission_id"]},
    ).json()

    assert second["submission_id"] == first["submission_id"]
    assert second["submitted"] is True
    assert len(store.list_submissions()) == 1
    assert store.get_submission(first["submission_id"])["external_status"] == "sent"
