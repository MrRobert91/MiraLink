from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(slots=True)
class Settings:
    app_name: str = "MiraLink API"
    allowed_origins: list[str] | None = None
    profile_db_path: str = os.getenv("PROFILE_DB_PATH", "data/profiles.db")

    responses_db_path: str = os.getenv("RESPONSES_DB_PATH", "data/form_responses.db")

    # TTS: modelos horneados en la imagen (fuera del volumen) y caché de audios
    # dentro del volumen persistente.
    tts_models_dir: str = os.getenv("TTS_MODELS_DIR", "models")
    tts_cache_dir: str = os.getenv("TTS_CACHE_DIR", "data/tts")
    tts_cache_db_path: str = os.getenv("TTS_CACHE_DB_PATH", "data/tts_cache.db")
    tts_cache_max_mb: int = int(os.getenv("TTS_CACHE_MAX_MB", "500"))
    tts_cache_ttl_days: int = int(os.getenv("TTS_CACHE_TTL_DAYS", "120"))

    @classmethod
    def from_env(cls) -> "Settings":
        raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
        origins = None if raw_origins.strip() == "*" else [item.strip() for item in raw_origins.split(",") if item.strip()]
        return cls(
            allowed_origins=origins,
            profile_db_path=os.getenv("PROFILE_DB_PATH", "data/profiles.db"),
            responses_db_path=os.getenv("RESPONSES_DB_PATH", "data/form_responses.db"),
            tts_models_dir=os.getenv("TTS_MODELS_DIR", "models"),
            tts_cache_dir=os.getenv("TTS_CACHE_DIR", "data/tts"),
            tts_cache_db_path=os.getenv("TTS_CACHE_DB_PATH", "data/tts_cache.db"),
            tts_cache_max_mb=int(os.getenv("TTS_CACHE_MAX_MB", "500")),
            tts_cache_ttl_days=int(os.getenv("TTS_CACHE_TTL_DAYS", "120")),
        )
