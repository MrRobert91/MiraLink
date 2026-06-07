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
from app.services.google_forms import GoogleFormError
from app.services.profiles import ProfilePreferences, SqliteProfileStore, UserProfile


class GoogleFormImportRequest(BaseModel):
    url: str


class FormQuestionMeta(BaseModel):
    entry_id: str
    title: str
    type: str


class AuxiliaryAnswer(BaseModel):
    question_title: str
    selected_options: list[str]


class GoogleFormSubmitRequest(BaseModel):
    url: str
    submit_url: str = ""
    submission_id: str = ""
    answers: dict[str, list[str]]
    form_id: str = ""
    form_title: str = ""
    provider: str = ""
    questions: list[FormQuestionMeta] = []
    duration_seconds: float | None = None
    auxiliary_answers: list[AuxiliaryAnswer] = []


class SaveFormRequest(BaseModel):
    form_id: str
    form_title: str
    form_url: str
    provider: str


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


def create_app(
    settings: Settings | None = None,
    profile_store: SqliteProfileStore | None = None,
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

    profiles = profile_store or SqliteProfileStore(Path(app_settings.profile_db_path))
    responses = response_store or SqliteFormResponseStore(Path(app_settings.responses_db_path))

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/profiles/{user_id}", response_model=UserProfile)
    def get_profile(user_id: str) -> UserProfile:
        return profiles.get_profile(user_id)

    @app.put("/api/profiles/{user_id}", response_model=UserProfile)
    def update_profile(user_id: str, payload: ProfilePreferences) -> UserProfile:
        return profiles.upsert_preferences(user_id, payload)

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

        # Preguntas auxiliares personalizadas: se guardan aparte y NUNCA se envían
        # al proveedor externo (solo se persisten localmente).
        answer_records.extend(
            {
                "entry_id": f"aux:{index}",
                "question_title": aux.question_title,
                "question_type": "radio",
                "selected_options": aux.selected_options,
                "is_auxiliary": True,
            }
            for index, aux in enumerate(payload.auxiliary_answers)
            if aux.selected_options
        )

        submission_id = responses.record_submission(
            submission_id=payload.submission_id or None,
            form_id=payload.form_id or payload.url,
            form_title=payload.form_title or "Sin titulo",
            form_url=payload.url,
            provider=payload.provider or "unknown",
            duration_seconds=payload.duration_seconds,
            answers=answer_records,
        )

        try:
            result = submit_external_form(payload.url, payload.submit_url, payload.answers)
        except GoogleFormError as exc:
            logger.warning("submit form_error url=%s answers_keys=%s error=%s", payload.url, list(payload.answers.keys()), exc)
            message = f"Respuestas guardadas localmente. No se pudo enviar el formulario: {exc}"
            responses.update_external_status(
                submission_id,
                status="failed",
                status_code=None,
                message=message,
            )
            return {
                "submission_id": submission_id,
                "saved": True,
                "submitted": False,
                "status_code": None,
                "message": message,
            }
        except Exception as exc:
            logger.exception("submit unexpected_error url=%s", payload.url)
            message = "Respuestas guardadas localmente. No se pudo enviar el formulario."
            responses.update_external_status(
                submission_id,
                status="failed",
                status_code=None,
                message=message,
            )
            return {
                "submission_id": submission_id,
                "saved": True,
                "submitted": False,
                "status_code": None,
                "message": message,
            }

        submitted = result["submitted"] if isinstance(result, dict) else result.submitted
        status_code = result["status_code"] if isinstance(result, dict) else result.status_code
        provider_message = result["message"] if isinstance(result, dict) else result.message
        message = (
            provider_message
            if submitted
            else f"Respuestas guardadas localmente. {provider_message}"
        )
        responses.update_external_status(
            submission_id,
            status="sent" if submitted else "failed",
            status_code=status_code,
            message=message,
        )
        return {
            "submission_id": submission_id,
            "saved": True,
            "submitted": submitted,
            "status_code": status_code,
            "message": message,
        }

    @app.get("/api/admin/submissions")
    def list_submissions():
        return responses.list_submissions()

    @app.get("/api/admin/submissions/export/csv")
    def export_submissions_csv(ids: str = "", include_auxiliary: bool = True):
        id_list = [i.strip() for i in ids.split(",") if i.strip()] if ids else None
        csv_content = responses.export_csv(ids=id_list, include_auxiliary=include_auxiliary)
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
