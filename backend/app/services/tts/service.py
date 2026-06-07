from __future__ import annotations

from pathlib import Path
from urllib.parse import urlencode

from app.services.tts.base import Voice
from app.services.tts.cache import TtsCache
from app.services.tts.registry import TtsRegistry, parse_voice_id


def _audio_url(form_id: str, voice_id: str, hash_: str) -> str:
    query = urlencode({"form_id": form_id, "voice_id": voice_id, "hash": hash_})
    return f"/api/tts/audio?{query}"


class TtsService:
    """Orquesta catálogo de voces, síntesis perezosa y caché por formulario."""

    def __init__(
        self,
        registry: TtsRegistry,
        cache: TtsCache,
        cache_max_mb: int,
        cache_ttl_days: int,
    ) -> None:
        self._registry = registry
        self._cache = cache
        self._cache_max_mb = cache_max_mb
        self._cache_ttl_days = cache_ttl_days

    def list_voices(self) -> list[Voice]:
        return self._registry.available_voices()

    def prepare(
        self,
        form_id: str,
        voice_id: str,
        items: list[tuple[str, str]],
    ) -> dict[str, str]:
        """Genera/reutiliza los audios de un formulario y devuelve {key: url}.

        `items` es una lista de (key, text). La reutilización es por texto: solo
        se llama al modelo para los textos cuyo audio no exista ya en caché.
        """
        engine_name, local_voice = parse_voice_id(voice_id)
        engine = self._registry.get(engine_name)

        urls: dict[str, str] = {}
        keep: set[str] = set()
        for key, text in items:
            hash_, _ = self._cache.get_or_create(
                form_id,
                voice_id,
                text,
                synth=lambda text=text: engine.synthesize(text, local_voice),
            )
            keep.add(hash_)
            urls[key] = _audio_url(form_id, voice_id, hash_)

        # Limpia audios obsoletos del formulario (si cambió) y aplica eviction global.
        self._cache.prune_form(form_id, voice_id, keep)
        self._cache.enforce_limits(self._cache_max_mb, self._cache_ttl_days)
        return urls

    def resolve_audio(self, form_id: str, voice_id: str, hash_: str) -> Path | None:
        return self._cache.resolve(form_id, voice_id, hash_)
