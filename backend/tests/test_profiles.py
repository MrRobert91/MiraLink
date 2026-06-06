from pathlib import Path
import sqlite3
from uuid import uuid4

from app.services.profiles import ProfilePreferences, SqliteProfileStore


def test_profile_store_persists_preferences_across_instances():
    database_path = _workspace_database_path()

    first_store = SqliteProfileStore(database_path)
    first_store.upsert_preferences(
        "demo-user",
        ProfilePreferences(language="es", dwell_ms=900, high_contrast=True),
    )

    second_store = SqliteProfileStore(database_path)
    profile = second_store.get_profile("demo-user")

    assert profile.user_id == "demo-user"
    assert profile.preferences.language == "es"
    assert profile.preferences.dwell_ms == 900
    assert profile.preferences.high_contrast is True


def test_profile_store_persists_all_miralink_preferences():
    database_path = _workspace_database_path()
    store = SqliteProfileStore(database_path)

    store.upsert_preferences(
        "miralink-default",
        ProfilePreferences(
            language="es",
            provider_mode="pointer",
            dwell_ms=2400,
            neutral_zone_percent=30,
            stabilization=74,
            horizontal_sensitivity=1.65,
            vertical_sensitivity=1.35,
            high_contrast=True,
            use_pitch_assist=False,
            invert_vertical_axis=True,
            camera_opacity=60,
            camera_visible=False,
            center_precision=70,
        ),
    )

    preferences = SqliteProfileStore(database_path).get_profile("miralink-default").preferences

    assert preferences.provider_mode == "pointer"
    assert preferences.dwell_ms == 2400
    assert preferences.neutral_zone_percent == 30
    assert preferences.stabilization == 74
    assert preferences.horizontal_sensitivity == 1.65
    assert preferences.vertical_sensitivity == 1.35
    assert preferences.high_contrast is True
    assert preferences.use_pitch_assist is False
    assert preferences.invert_vertical_axis is True
    assert preferences.camera_opacity == 60
    assert preferences.camera_visible is False
    assert preferences.center_precision == 70


def test_profile_store_migrates_existing_preference_table_without_losing_values():
    database_path = _workspace_database_path()
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE profile_preferences (
                user_id TEXT PRIMARY KEY,
                language TEXT NOT NULL DEFAULT 'es',
                dwell_ms INTEGER NOT NULL DEFAULT 850,
                high_contrast INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        connection.execute(
            """
            INSERT INTO profile_preferences (user_id, language, dwell_ms, high_contrast)
            VALUES ('existing-user', 'es', 1100, 1)
            """
        )

    profile = SqliteProfileStore(database_path).get_profile("existing-user")

    assert profile.preferences.dwell_ms == 1100
    assert profile.preferences.high_contrast is True
    assert profile.preferences.provider_mode == "mediapipe"
    assert profile.preferences.neutral_zone_percent == 24
    assert profile.preferences.use_pitch_assist is True
    assert profile.preferences.camera_opacity == 35
    assert profile.preferences.camera_visible is True
    assert profile.preferences.center_precision == 50


def _workspace_database_path() -> Path:
    temp_dir = Path(__file__).resolve().parent / ".tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir / f"{uuid4().hex}.db"
