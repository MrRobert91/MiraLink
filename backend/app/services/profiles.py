from __future__ import annotations

import sqlite3
from pathlib import Path

from pydantic import BaseModel


class ProfilePreferences(BaseModel):
    language: str = "es"
    provider_mode: str = "mediapipe"
    dwell_ms: int = 3000
    neutral_zone_percent: int = 24
    stabilization: int = 82
    horizontal_sensitivity: float = 1.2
    vertical_sensitivity: float = 1.2
    theme: str = "light"
    high_contrast: bool = False
    use_pitch_assist: bool = True
    invert_vertical_axis: bool = False
    camera_opacity: int = 35
    camera_visible: bool = True
    center_precision: int = 50
    eye_rest_enabled: bool = True
    eye_rest_trigger_seconds: int = 10
    eye_rest_pause_seconds: int = 60


class UserProfile(BaseModel):
    user_id: str
    preferences: ProfilePreferences


class SqliteProfileStore:
    def __init__(self, database_path: Path | str) -> None:
        self._database_path = Path(database_path)
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS profile_preferences (
                    user_id TEXT PRIMARY KEY,
                    language TEXT NOT NULL DEFAULT 'es',
                    provider_mode TEXT NOT NULL DEFAULT 'mediapipe',
                    dwell_ms INTEGER NOT NULL DEFAULT 3000,
                    neutral_zone_percent INTEGER NOT NULL DEFAULT 24,
                    stabilization INTEGER NOT NULL DEFAULT 82,
                    horizontal_sensitivity REAL NOT NULL DEFAULT 1.2,
                    vertical_sensitivity REAL NOT NULL DEFAULT 1.2,
                    theme TEXT NOT NULL DEFAULT 'light',
                    high_contrast INTEGER NOT NULL DEFAULT 0,
                    use_pitch_assist INTEGER NOT NULL DEFAULT 1,
                    invert_vertical_axis INTEGER NOT NULL DEFAULT 0,
                    camera_opacity INTEGER NOT NULL DEFAULT 35,
                    camera_visible INTEGER NOT NULL DEFAULT 1,
                    center_precision INTEGER NOT NULL DEFAULT 50,
                    eye_rest_enabled INTEGER NOT NULL DEFAULT 1,
                    eye_rest_trigger_seconds INTEGER NOT NULL DEFAULT 10,
                    eye_rest_pause_seconds INTEGER NOT NULL DEFAULT 60
                );
                """
            )
            existing_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(profile_preferences)").fetchall()
            }
            migration_columns = {
                "provider_mode": "TEXT NOT NULL DEFAULT 'mediapipe'",
                "neutral_zone_percent": "INTEGER NOT NULL DEFAULT 24",
                "stabilization": "INTEGER NOT NULL DEFAULT 82",
                "horizontal_sensitivity": "REAL NOT NULL DEFAULT 1.2",
                "vertical_sensitivity": "REAL NOT NULL DEFAULT 1.2",
                "theme": "TEXT NOT NULL DEFAULT 'light'",
                "use_pitch_assist": "INTEGER NOT NULL DEFAULT 1",
                "invert_vertical_axis": "INTEGER NOT NULL DEFAULT 0",
                "camera_opacity": "INTEGER NOT NULL DEFAULT 35",
                "camera_visible": "INTEGER NOT NULL DEFAULT 1",
                "center_precision": "INTEGER NOT NULL DEFAULT 50",
                "eye_rest_enabled": "INTEGER NOT NULL DEFAULT 1",
                "eye_rest_trigger_seconds": "INTEGER NOT NULL DEFAULT 10",
                "eye_rest_pause_seconds": "INTEGER NOT NULL DEFAULT 60",
            }
            for column_name, definition in migration_columns.items():
                if column_name not in existing_columns:
                    connection.execute(
                        f"ALTER TABLE profile_preferences ADD COLUMN {column_name} {definition}"
                    )

    def ensure_profile(self, user_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO profile_preferences (user_id) VALUES (?)
                ON CONFLICT(user_id) DO NOTHING
                """,
                (user_id,),
            )

    def upsert_preferences(self, user_id: str, preferences: ProfilePreferences) -> UserProfile:
        self.ensure_profile(user_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO profile_preferences (
                    user_id, language, provider_mode, dwell_ms, neutral_zone_percent,
                    stabilization, horizontal_sensitivity, vertical_sensitivity,
                    theme, high_contrast, use_pitch_assist, invert_vertical_axis,
                    camera_opacity, camera_visible, center_precision,
                    eye_rest_enabled, eye_rest_trigger_seconds, eye_rest_pause_seconds
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    language=excluded.language,
                    provider_mode=excluded.provider_mode,
                    dwell_ms=excluded.dwell_ms,
                    neutral_zone_percent=excluded.neutral_zone_percent,
                    stabilization=excluded.stabilization,
                    horizontal_sensitivity=excluded.horizontal_sensitivity,
                    vertical_sensitivity=excluded.vertical_sensitivity,
                    theme=excluded.theme,
                    high_contrast=excluded.high_contrast,
                    use_pitch_assist=excluded.use_pitch_assist,
                    invert_vertical_axis=excluded.invert_vertical_axis,
                    camera_opacity=excluded.camera_opacity,
                    camera_visible=excluded.camera_visible,
                    center_precision=excluded.center_precision,
                    eye_rest_enabled=excluded.eye_rest_enabled,
                    eye_rest_trigger_seconds=excluded.eye_rest_trigger_seconds,
                    eye_rest_pause_seconds=excluded.eye_rest_pause_seconds
                """,
                (
                    user_id,
                    preferences.language,
                    preferences.provider_mode,
                    preferences.dwell_ms,
                    preferences.neutral_zone_percent,
                    preferences.stabilization,
                    preferences.horizontal_sensitivity,
                    preferences.vertical_sensitivity,
                    preferences.theme,
                    int(preferences.high_contrast),
                    int(preferences.use_pitch_assist),
                    int(preferences.invert_vertical_axis),
                    preferences.camera_opacity,
                    int(preferences.camera_visible),
                    preferences.center_precision,
                    int(preferences.eye_rest_enabled),
                    preferences.eye_rest_trigger_seconds,
                    preferences.eye_rest_pause_seconds,
                ),
            )
        return self.get_profile(user_id)

    def get_profile(self, user_id: str) -> UserProfile:
        self.ensure_profile(user_id)
        with self._connect() as connection:
            preference_row = connection.execute(
                """
                SELECT user_id, language, provider_mode, dwell_ms, neutral_zone_percent,
                       stabilization, horizontal_sensitivity, vertical_sensitivity,
                       theme, high_contrast, use_pitch_assist, invert_vertical_axis,
                       camera_opacity, camera_visible, center_precision,
                       eye_rest_enabled, eye_rest_trigger_seconds, eye_rest_pause_seconds
                FROM profile_preferences
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()

        return UserProfile(
            user_id=user_id,
            preferences=ProfilePreferences(
                language=preference_row["language"],
                provider_mode=preference_row["provider_mode"],
                dwell_ms=preference_row["dwell_ms"],
                neutral_zone_percent=preference_row["neutral_zone_percent"],
                stabilization=preference_row["stabilization"],
                horizontal_sensitivity=preference_row["horizontal_sensitivity"],
                vertical_sensitivity=preference_row["vertical_sensitivity"],
                theme=preference_row["theme"],
                high_contrast=bool(preference_row["high_contrast"]),
                use_pitch_assist=bool(preference_row["use_pitch_assist"]),
                invert_vertical_axis=bool(preference_row["invert_vertical_axis"]),
                camera_opacity=preference_row["camera_opacity"],
                camera_visible=bool(preference_row["camera_visible"]),
                center_precision=preference_row["center_precision"],
                eye_rest_enabled=bool(preference_row["eye_rest_enabled"]),
                eye_rest_trigger_seconds=preference_row["eye_rest_trigger_seconds"],
                eye_rest_pause_seconds=preference_row["eye_rest_pause_seconds"],
            ),
        )
