from __future__ import annotations

import hashlib
import re
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Callable

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe(component: str) -> str:
    """Sanea un id para usarlo como nombre de carpeta en el volumen."""
    cleaned = _UNSAFE.sub("_", component).strip("._")
    return cleaned or "_"


def text_hash(text: str) -> str:
    """Hash estable del texto normalizado (espacios colapsados).

    Es la garantía de "mismas preguntas/respuestas": si el texto de una pregunta
    u opción cambia, su hash cambia y el audio se regenera; si es idéntico, se
    reutiliza el archivo ya cacheado.
    """
    normalized = " ".join(text.split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _now() -> str:
    return datetime.now(UTC).isoformat()


class TtsCache:
    """Caché de audios TTS en el volumen, indexada en SQLite.

    Layout en disco: <cache_dir>/forms/<form_id>/<voice_id>/<text_hash>.wav
    """

    def __init__(self, cache_dir: Path | str, db_path: Path | str) -> None:
        self._cache_dir = Path(cache_dir)
        self._db_path = Path(db_path)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS tts_audio (
                    form_id TEXT NOT NULL,
                    voice_id TEXT NOT NULL,
                    text_hash TEXT NOT NULL,
                    path TEXT NOT NULL,
                    bytes INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    last_used_at TEXT NOT NULL,
                    PRIMARY KEY (form_id, voice_id, text_hash)
                );
                CREATE INDEX IF NOT EXISTS idx_tts_audio_last_used
                    ON tts_audio(last_used_at);
                """
            )

    def _path_for(self, form_id: str, voice_id: str, hash_: str) -> Path:
        return self._cache_dir / "forms" / _safe(form_id) / _safe(voice_id) / f"{hash_}.wav"

    def get_or_create(
        self,
        form_id: str,
        voice_id: str,
        text: str,
        synth: Callable[[], bytes],
    ) -> tuple[str, Path]:
        """Devuelve (text_hash, path), sintetizando solo si falta en caché."""
        hash_ = text_hash(text)
        path = self._path_for(form_id, voice_id, hash_)

        with self._connect() as connection:
            row = connection.execute(
                "SELECT path FROM tts_audio WHERE form_id=? AND voice_id=? AND text_hash=?",
                (form_id, voice_id, hash_),
            ).fetchone()
            if row is not None and Path(row["path"]).exists():
                connection.execute(
                    "UPDATE tts_audio SET last_used_at=? WHERE form_id=? AND voice_id=? AND text_hash=?",
                    (_now(), form_id, voice_id, hash_),
                )
                return hash_, Path(row["path"])

        # Cache miss (o archivo borrado a mano): generar y persistir.
        data = synth()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        now = _now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO tts_audio (form_id, voice_id, text_hash, path, bytes, created_at, last_used_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(form_id, voice_id, text_hash) DO UPDATE SET
                    path=excluded.path, bytes=excluded.bytes, last_used_at=excluded.last_used_at
                """,
                (form_id, voice_id, hash_, str(path), len(data), now, now),
            )
        return hash_, path

    def resolve(self, form_id: str, voice_id: str, hash_: str) -> Path | None:
        """Localiza un audio cacheado para servirlo y marca su uso."""
        with self._connect() as connection:
            row = connection.execute(
                "SELECT path FROM tts_audio WHERE form_id=? AND voice_id=? AND text_hash=?",
                (form_id, voice_id, hash_),
            ).fetchone()
            if row is None:
                return None
            path = Path(row["path"])
            if not path.exists():
                return None
            connection.execute(
                "UPDATE tts_audio SET last_used_at=? WHERE form_id=? AND voice_id=? AND text_hash=?",
                (_now(), form_id, voice_id, hash_),
            )
            return path

    def prune_form(self, form_id: str, voice_id: str, keep_hashes: set[str]) -> int:
        """Elimina audios de un formulario/voz que ya no están entre los vigentes.

        Garantiza que, si el formulario cambia (preguntas/respuestas distintas),
        los audios obsoletos no se quedan acumulados en el volumen.
        """
        removed = 0
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT text_hash, path FROM tts_audio WHERE form_id=? AND voice_id=?",
                (form_id, voice_id),
            ).fetchall()
            stale = [r for r in rows if r["text_hash"] not in keep_hashes]
            for row in stale:
                Path(row["path"]).unlink(missing_ok=True)
                connection.execute(
                    "DELETE FROM tts_audio WHERE form_id=? AND voice_id=? AND text_hash=?",
                    (form_id, voice_id, row["text_hash"]),
                )
                removed += 1
        return removed

    def enforce_limits(self, max_mb: int, ttl_days: int) -> int:
        """Aplica eviction: primero por antigüedad (TTL), luego LRU por tamaño."""
        removed = 0
        with self._connect() as connection:
            if ttl_days > 0:
                cutoff = (datetime.now(UTC) - timedelta(days=ttl_days)).isoformat()
                expired = connection.execute(
                    "SELECT form_id, voice_id, text_hash, path FROM tts_audio WHERE last_used_at < ?",
                    (cutoff,),
                ).fetchall()
                for row in expired:
                    Path(row["path"]).unlink(missing_ok=True)
                    connection.execute(
                        "DELETE FROM tts_audio WHERE form_id=? AND voice_id=? AND text_hash=?",
                        (row["form_id"], row["voice_id"], row["text_hash"]),
                    )
                    removed += 1

            max_bytes = max_mb * 1024 * 1024
            if max_bytes > 0:
                total = connection.execute(
                    "SELECT COALESCE(SUM(bytes), 0) AS total FROM tts_audio"
                ).fetchone()["total"]
                if total > max_bytes:
                    # Borra los menos usados recientemente hasta bajar del límite.
                    candidates = connection.execute(
                        "SELECT form_id, voice_id, text_hash, path, bytes FROM tts_audio ORDER BY last_used_at ASC"
                    ).fetchall()
                    for row in candidates:
                        if total <= max_bytes:
                            break
                        Path(row["path"]).unlink(missing_ok=True)
                        connection.execute(
                            "DELETE FROM tts_audio WHERE form_id=? AND voice_id=? AND text_hash=?",
                            (row["form_id"], row["voice_id"], row["text_hash"]),
                        )
                        total -= row["bytes"]
                        removed += 1
        return removed
