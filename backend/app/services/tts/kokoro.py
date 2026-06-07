from __future__ import annotations

from app.services.tts.base import TtsError, Voice


class KokoroEngine:
    """Esqueleto del motor Kokoro, registrado pero todavía sin modelo.

    Demuestra que añadir un motor nuevo no toca ni la API ni el frontend: en
    cuanto `enabled=True` y se exponga al menos una voz, aparecerá solo en el
    catálogo `GET /api/tts/voices` y en el selector de Ajustes.
    """

    name = "kokoro"

    def __init__(self, enabled: bool = False) -> None:
        self._enabled = enabled

    def list_voices(self) -> list[Voice]:
        # Aún no hay modelo disponible; no se anuncia ninguna voz.
        return []

    def synthesize(self, text: str, voice_id: str) -> bytes:
        raise TtsError("El motor Kokoro todavía no está disponible.")
