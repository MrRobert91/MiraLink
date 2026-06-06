from fastapi.testclient import TestClient

from app.main import create_app
from app.services.form_responses import SqliteFormResponseStore
from app.services.gemma import BaseGemmaReranker, NoopGemmaReranker, RerankRequest
from app.services.google_forms import (
    GoogleFormError,
    GoogleFormOption,
    GoogleFormQuestion,
    ImportedGoogleForm,
)


class FixedReranker(BaseGemmaReranker):
    provider_name = "fixed"
    model_name = "fixed-model"

    def rerank(self, request: RerankRequest) -> list[str]:
        return list(reversed(request.candidates))


def test_predict_endpoint_returns_ranked_suggestions():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post(
        "/api/predict",
        json={"user_id": "demo", "text": "quiero a", "language": "es"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "suggestions" in payload
    assert payload["suggestions"][0]["text"] == "agua"


def test_tts_endpoint_returns_mock_audio():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post(
        "/api/tts",
        json={"text": "Hola", "language": "es-ES", "voice": "default"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mime_type"] == "audio/wav"
    assert payload["audio_base64"]


def test_profile_endpoint_persists_preferences():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))
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


def test_gemma_rerank_endpoint_returns_proxy_response():
    client = TestClient(create_app(gemma_reranker=FixedReranker()))

    response = client.post(
        "/api/gemma/rerank",
        json={
            "user_id": "demo",
            "language": "es",
            "context": "quiero a",
            "candidates": ["agua", "ahora", "ayuda"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "fixed"
    assert payload["model"] == "fixed-model"
    assert payload["ordered_candidates"] == ["ayuda", "ahora", "agua"]


def test_google_forms_import_endpoint_returns_imported_form(monkeypatch):
    form = ImportedGoogleForm(
        form_id="abc123",
        title="Cuestionario diario",
        submit_url="https://docs.google.com/forms/d/e/abc123/formResponse",
        questions=[
            GoogleFormQuestion(
                id="q1",
                entry_id="entry.111",
                title="Como te encuentras?",
                type="checkbox",
                options=[GoogleFormOption(id="q1-0", label="Tengo sed")],
            )
        ],
    )
    monkeypatch.setattr("app.main.import_google_form", lambda url: form)
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post("/api/google-forms/import", json={"url": "https://docs.google.com/forms/d/e/abc123/viewform"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Cuestionario diario"
    assert payload["questions"][0]["options"][0]["label"] == "Tengo sed"


def test_google_forms_submit_endpoint_posts_answers(monkeypatch):
    form = ImportedGoogleForm(
        form_id="abc123",
        title="Cuestionario diario",
        submit_url="https://docs.google.com/forms/d/e/abc123/formResponse",
        questions=[
            GoogleFormQuestion(
                id="q1",
                entry_id="entry.111",
                title="Como te encuentras?",
                type="checkbox",
                options=[GoogleFormOption(id="q1-0", label="Tengo sed")],
            )
        ],
    )
    monkeypatch.setattr("app.main.import_google_form", lambda url: form)
    monkeypatch.setattr("app.main.submit_google_form", lambda imported_form, answers: {"submitted": True, "status_code": 200, "message": "Formulario enviado."})
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post(
        "/api/google-forms/submit",
        json={"url": "https://docs.google.com/forms/d/e/abc123/viewform", "answers": {"q1": ["Tengo sed"]}},
    )

    assert response.status_code == 200
    assert response.json()["submitted"] is True


def test_generic_forms_import_endpoint_routes_by_url(monkeypatch):
    form = ImportedGoogleForm(
        form_id="abc123",
        title="Cuestionario diario",
        submit_url="https://docs.google.com/forms/d/e/abc123/formResponse",
        questions=[],
    )
    monkeypatch.setattr("app.main.import_external_form", lambda url: form)
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post("/api/forms/import", json={"url": "https://forms.office.com/r/abc123"})

    assert response.status_code == 200
    assert response.json()["title"] == "Cuestionario diario"


def test_generic_forms_submit_endpoint_saves_and_marks_success(monkeypatch, tmp_path):
    monkeypatch.setattr("app.main.submit_external_form", lambda url, submit_url, answers: {"submitted": True, "status_code": 200, "message": "Formulario enviado."})
    store = SqliteFormResponseStore(tmp_path / "responses.db")
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker(), response_store=store))

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
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker(), response_store=store))

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
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker(), response_store=store))

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
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker(), response_store=store))
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
