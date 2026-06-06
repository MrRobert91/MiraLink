from __future__ import annotations

import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.config import Settings
from app.services.external_forms import import_external_form, submit_external_form
from app.services.form_responses import SqliteFormResponseStore
from app.services.gemma import BaseGemmaReranker, RerankRequest, RerankResponse, build_gemma_reranker
from app.services.google_forms import GoogleFormError, import_google_form, submit_google_form
from app.services.predictor import PredictionRequest, PredictionResponse, SuggestionEngine
from app.services.profiles import ProfilePreferences, SqliteProfileStore, UserProfile
from app.services.session_store import InMemorySessionStore, Session, SessionSnapshot
from app.services.tts import BaseTTSProvider, TTSRequest, TTSResult, build_tts_provider


class SessionStartRequest(BaseModel):
    user_id: str = "demo-user"


class SessionTextRequest(BaseModel):
    text: str


class SessionCommitRequest(BaseModel):
    phrase: str


class GoogleFormImportRequest(BaseModel):
    url: str


class FormQuestionMeta(BaseModel):
    entry_id: str
    title: str
    type: str


class GoogleFormSubmitRequest(BaseModel):
    url: str
    submit_url: str = ""
    answers: dict[str, list[str]]
    form_id: str = ""
    form_title: str = ""
    provider: str = ""
    questions: list[FormQuestionMeta] = []
    duration_seconds: float | None = None


class SaveFormRequest(BaseModel):
    form_id: str
    form_title: str
    form_url: str
    provider: str


def build_default_engine() -> SuggestionEngine:
    engine = SuggestionEngine(
        global_phrases=[
            "necesito ayuda",
            "quiero agua",
            "quiero descansar",
            "hola",
            "gracias",
            "por favor",
            "me duele",
            "quiero hablar con mi familia",
        ],
        domain_vocabulary=[
            "agua",
            "ahora",
            "ayuda",
            "baño",
            "borrar",
            "comer",
            "descansar",
            "dolor",
            "familia",
            "gracias",
            "hablar",
            "hola",
            "medicina",
            "necesito",
            "por",
            "favor",
            "quiero",
            "sí",
            "no",
        ],
        reranker=build_gemma_reranker(),
    )
    engine.learn_phrase("demo", "quiero agua")
    engine.learn_phrase("demo", "quiero ayuda")
    return engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


def create_app(
    settings: Settings | None = None,
    engine: SuggestionEngine | None = None,
    tts_provider: BaseTTSProvider | None = None,
    session_store: InMemorySessionStore | None = None,
    profile_store: SqliteProfileStore | None = None,
    gemma_reranker: BaseGemmaReranker | None = None,
    response_store: SqliteFormResponseStore | None = None,
) -> FastAPI:
    app_settings = settings or Settings.from_env()
    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.allowed_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    reranker = gemma_reranker or build_gemma_reranker()
    prediction_engine = engine or SuggestionEngine(
        global_phrases=[
            "necesito ayuda",
            "quiero agua",
            "quiero descansar",
            "hola",
            "gracias",
            "por favor",
            "me duele",
            "quiero hablar con mi familia",
        ],
        domain_vocabulary=[
            "agua",
            "ahora",
            "ayuda",
            "baño",
            "borrar",
            "comer",
            "descansar",
            "dolor",
            "familia",
            "gracias",
            "hablar",
            "hola",
            "medicina",
            "necesito",
            "por",
            "favor",
            "quiero",
            "sí",
            "no",
        ],
        reranker=reranker,
    )
    if engine is None:
        prediction_engine.learn_phrase("demo", "quiero agua")
        prediction_engine.learn_phrase("demo", "quiero ayuda")
    sessions = session_store or InMemorySessionStore()
    provider = tts_provider or build_tts_provider(app_settings.tts_provider)
    profiles = profile_store or SqliteProfileStore(Path(app_settings.profile_db_path))
    responses = response_store or SqliteFormResponseStore(Path(app_settings.responses_db_path))

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/predict", response_model=PredictionResponse)
    def predict(payload: PredictionRequest) -> PredictionResponse:
        profiles.hydrate_engine(prediction_engine, payload.user_id)
        return prediction_engine.predict(payload)

    @app.post("/api/gemma/rerank", response_model=RerankResponse)
    def gemma_rerank(payload: RerankRequest) -> RerankResponse:
        ordered_candidates = reranker.rerank(payload)
        return RerankResponse(
            ordered_candidates=ordered_candidates,
            provider=reranker.provider_name,
            model=reranker.model_name,
        )

    @app.post("/api/tts", response_model=TTSResult)
    def synthesize(payload: TTSRequest) -> TTSResult:
        return provider.synthesize(payload)

    @app.post("/api/sessions/start", response_model=Session)
    def start_session(payload: SessionStartRequest) -> Session:
        profiles.ensure_profile(payload.user_id)
        return sessions.start_session(payload.user_id)

    @app.post("/api/sessions/{session_id}/text", response_model=SessionSnapshot)
    def update_session_text(session_id: str, payload: SessionTextRequest) -> SessionSnapshot:
        return sessions.update_text(session_id, payload.text)

    @app.post("/api/sessions/{session_id}/commit", response_model=SessionSnapshot)
    def commit_session_phrase(session_id: str, payload: SessionCommitRequest) -> SessionSnapshot:
        snapshot = sessions.get_snapshot(session_id)
        profiles.record_phrase(snapshot.user_id, payload.phrase)
        prediction_engine.learn_phrase(snapshot.user_id, payload.phrase)
        return sessions.commit_phrase(session_id, payload.phrase)

    @app.get("/api/sessions/{session_id}", response_model=SessionSnapshot)
    def get_session_snapshot(session_id: str) -> SessionSnapshot:
        return sessions.get_snapshot(session_id)

    @app.get("/api/profiles/{user_id}", response_model=UserProfile)
    def get_profile(user_id: str) -> UserProfile:
        return profiles.get_profile(user_id)

    @app.put("/api/profiles/{user_id}", response_model=UserProfile)
    def update_profile(user_id: str, payload: ProfilePreferences) -> UserProfile:
        return profiles.upsert_preferences(user_id, payload)

    @app.post("/api/google-forms/import")
    def import_google_form_endpoint(payload: GoogleFormImportRequest):
        try:
            return import_google_form(payload.url)
        except GoogleFormError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="No se pudo leer el formulario de Google Forms.") from exc

    @app.post("/api/google-forms/submit")
    def submit_google_form_endpoint(payload: GoogleFormSubmitRequest):
        try:
            imported_form = import_google_form(payload.url)
            return submit_google_form(imported_form, payload.answers)
        except GoogleFormError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="No se pudo enviar el formulario a Google Forms.") from exc

    @app.post("/api/forms/import")
    def import_form_endpoint(payload: GoogleFormImportRequest):
        try:
            return import_external_form(payload.url)
        except GoogleFormError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="No se pudo leer el formulario.") from exc

    @app.post("/api/forms/submit")
    def submit_form_endpoint(payload: GoogleFormSubmitRequest):
        question_map = {q.entry_id: q for q in payload.questions}
        answer_records = [
            {
                "entry_id": entry_id,
                "question_title": question_map[entry_id].title if entry_id in question_map else entry_id,
                "question_type": question_map[entry_id].type if entry_id in question_map else "radio",
                "selected_options": values,
            }
            for entry_id, values in payload.answers.items()
            if values
        ]

        def _persist() -> None:
            if not answer_records:
                return
            try:
                responses.record_submission(
                    form_id=payload.form_id or payload.url,
                    form_title=payload.form_title or "Sin titulo",
                    form_url=payload.url,
                    provider=payload.provider or "unknown",
                    duration_seconds=payload.duration_seconds,
                    answers=answer_records,
                )
            except Exception:
                pass

        try:
            result = submit_external_form(payload.url, payload.submit_url, payload.answers)
        except GoogleFormError as exc:
            logger.warning("submit form_error url=%s answers_keys=%s error=%s", payload.url, list(payload.answers.keys()), exc)
            _persist()
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("submit unexpected_error url=%s", payload.url)
            _persist()
            raise HTTPException(status_code=502, detail="No se pudo enviar el formulario.") from exc

        _persist()
        return result

    @app.get("/api/admin/submissions")
    def list_submissions():
        return responses.list_submissions()

    @app.get("/api/admin/submissions/export/csv")
    def export_submissions_csv(ids: str = ""):
        id_list = [i.strip() for i in ids.split(",") if i.strip()] if ids else None
        csv_content = responses.export_csv(ids=id_list)
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="respuestas.csv"'},
        )

    @app.get("/api/admin/submissions/{submission_id}")
    def get_submission(submission_id: str):
        record = responses.get_submission(submission_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Envio no encontrado.")
        return record

    @app.get("/api/forms/saved")
    def list_saved_forms():
        return responses.list_saved_forms()

    @app.post("/api/forms/saved")
    def save_form_endpoint(payload: SaveFormRequest):
        return responses.save_form(
            form_id=payload.form_id,
            form_title=payload.form_title,
            form_url=payload.form_url,
            provider=payload.provider,
        )

    @app.delete("/api/forms/saved")
    def delete_saved_form_endpoint(url: str):
        responses.delete_saved_form(url)
        return {"ok": True}

    return app


app = create_app()
