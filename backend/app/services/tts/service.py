from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import urlencode

from app.services.tts.base import Voice
from app.services.tts.cache import TtsCache
from app.services.tts.registry import TtsRegistry, parse_voice_id

logger = logging.getLogger(__name__)


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
        prune: bool = True,
    ) -> dict[str, str]:
        """Genera/reutiliza los audios de un formulario y devuelve {key: url}.

        `items` es una lista de (key, text). La reutilización es por texto: solo
        se llama al modelo para los textos cuyo audio no exista ya en caché.

        Si un texto concreto falla al sintetizarse, se omite (sin url) en vez de
        abortar todo el lote: así un único texto problemático no deja al cliente
        sin ningún audio pre-generado.

        `prune=False` permite trocear la pre-generación de un formulario en varias
        llamadas sin que cada lote borre los audios de los anteriores (el podado
        elimina del form_id lo que no esté en el lote actual). La limpieza global
        por TTL/tamaño solo se ejecuta cuando `prune=True`.
        """
        engine_name, local_voice = parse_voice_id(voice_id)
        engine = self._registry.get(engine_name)

        urls: dict[str, str] = {}
        keep: set[str] = set()
        for key, text in items:
            try:
                hash_, _ = self._cache.get_or_create(
                    form_id,
                    voice_id,
                    text,
                    synth=lambda text=text: engine.synthesize(text, local_voice),
                )
            except Exception:
                logger.exception(
                    "tts synth failed, skipping text form_id=%s voice=%s", form_id, voice_id
                )
                continue
            keep.add(hash_)
            urls[key] = _audio_url(form_id, voice_id, hash_)

        if prune:
            # Limpia audios obsoletos del formulario (si cambió) y aplica eviction global.
            self._cache.prune_form(form_id, voice_id, keep)
            self._cache.enforce_limits(self._cache_max_mb, self._cache_ttl_days)
        return urls

    def resolve_audio(self, form_id: str, voice_id: str, hash_: str) -> Path | None:
        return self._cache.resolve(form_id, voice_id, hash_)
