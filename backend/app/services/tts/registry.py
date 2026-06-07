from __future__ import annotations

from pathlib import Path

from app.services.tts.base import TtsEngine, TtsError, Voice
from app.services.tts.kokoro import KokoroEngine
from app.services.tts.piper import PiperEngine


def parse_voice_id(qualified_id: str) -> tuple[str, str]:
    """Divide "<engine>:<voiceId>" en (engine, voiceId)."""
    engine, separator, local = qualified_id.partition(":")
    if not separator:
        raise TtsError(f"Identificador de voz inválido: {qualified_id!r}")
    return engine, local


class TtsRegistry:
    """Registro de motores enchufables. Añadir un motor = `register(...)`."""

    def __init__(self) -> None:
        self._engines: dict[str, TtsEngine] = {}

    def register(self, engine: TtsEngine) -> None:
        self._engines[engine.name] = engine

    def get(self, name: str) -> TtsEngine:
        engine = self._engines.get(name)
        if engine is None:
            raise TtsError(f"Motor TTS desconocido: {name}")
        return engine

    def available_voices(self) -> list[Voice]:
        """Catálogo cualificado de todas las voces de backend disponibles."""
        voices: list[Voice] = []
        for engine in self._engines.values():
            for voice in engine.list_voices():
                # El frontend almacena el id cualificado "<engine>:<voiceId>".
                voices.append(voice.model_copy(update={"id": voice.qualified_id}))
        return voices


def build_default_registry(models_dir: Path | str) -> TtsRegistry:
    """Registro por defecto: Piper operativo + Kokoro como esqueleto."""
    registry = TtsRegistry()
    registry.register(PiperEngine(models_dir=models_dir))
    registry.register(KokoroEngine(enabled=False))
    return registry
