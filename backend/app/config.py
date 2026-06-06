from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(slots=True)
class Settings:
    app_name: str = "EyeSpeak Gemma API"
    allowed_origins: list[str] | None = None
    profile_db_path: str = os.getenv("PROFILE_DB_PATH", "data/profiles.db")

    responses_db_path: str = os.getenv("RESPONSES_DB_PATH", "data/form_responses.db")

    @classmethod
    def from_env(cls) -> "Settings":
        raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
        origins = None if raw_origins.strip() == "*" else [item.strip() for item in raw_origins.split(",") if item.strip()]
        return cls(
            allowed_origins=origins,
            profile_db_path=os.getenv("PROFILE_DB_PATH", "data/profiles.db"),
            responses_db_path=os.getenv("RESPONSES_DB_PATH", "data/form_responses.db"),
        )
