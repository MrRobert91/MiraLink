from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class TtsError(Exception):
    """Error de síntesis o de configuración de un motor TTS."""


class Voice(BaseModel):
    """Una voz ofrecida por un motor de backend.

    `id` es local al motor (p. ej. "es_ES-davefx-medium"). El identificador
    cualificado que viaja al frontend es "<engine>:<id>" (ver `qualified_id`).
    """

    id: str
    label: str
    engine: str
    lang: str

    @property
    def qualified_id(self) -> str:
        return f"{self.engine}:{self.id}"


@runtime_checkable
class TtsEngine(Protocol):
    """Contrato de un motor de síntesis enchufable.

    Implementar esta interfaz y registrarla en `registry` es lo único necesario
    para añadir un modelo nuevo (Piper, Kokoro, KittenTTS, …); ni la API ni el
    frontend necesitan cambios.
    """

    name: str

    def list_voices(self) -> list[Voice]:
        """Voces disponibles ahora mismo (vacío si el motor no está listo)."""
        ...

    def synthesize(self, text: str, voice_id: str) -> bytes:
        """Devuelve audio WAV (PCM) para `text` con la voz local `voice_id`."""
        ...
