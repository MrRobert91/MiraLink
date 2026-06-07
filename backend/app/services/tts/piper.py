from __future__ import annotations

import io
import wave
from pathlib import Path
from typing import Callable

from app.services.tts.base import TtsError, Voice


class PiperVoiceConfig:
    """Metadatos de una voz Piper y la ubicación de su modelo .onnx."""

    def __init__(self, voice_id: str, label: str, lang: str, model_filename: str) -> None:
        self.id = voice_id
        self.label = label
        self.lang = lang
        self.model_filename = model_filename


# Voz por defecto incluida en la imagen. Para añadir más, basta con ampliar esta
# lista y hornear/descargar el modelo correspondiente en `models_dir`.
DEFAULT_PIPER_VOICES: list[PiperVoiceConfig] = [
    PiperVoiceConfig(
        voice_id="es_ES-davefx-medium",
        label="Español (David, Piper)",
        lang="es-ES",
        model_filename="es_ES-davefx-medium.onnx",
    ),
]


class PiperEngine:
    """Motor TTS basado en Piper, ejecutado dentro del propio backend.

    Solo anuncia las voces cuyo modelo `.onnx` existe en `models_dir`, de modo
    que la imagen sin modelos degrada de forma elegante (catálogo vacío).
    """

    name = "piper"

    def __init__(
        self,
        models_dir: Path | str,
        voices: list[PiperVoiceConfig] | None = None,
        synth: Callable[[Path, str], bytes] | None = None,
    ) -> None:
        self._models_dir = Path(models_dir)
        self._voices = {v.id: v for v in (voices if voices is not None else DEFAULT_PIPER_VOICES)}
        # `synth` se inyecta en tests; en producción usa Piper de verdad.
        self._synth = synth or self._synthesize_with_piper
        self._loaded: dict[str, object] = {}

    def _model_path(self, voice_id: str) -> Path:
        return self._models_dir / self._voices[voice_id].model_filename

    def list_voices(self) -> list[Voice]:
        return [
            Voice(id=cfg.id, label=cfg.label, engine=self.name, lang=cfg.lang)
            for cfg in self._voices.values()
            if self._model_path(cfg.id).exists()
        ]

    def synthesize(self, text: str, voice_id: str) -> bytes:
        if voice_id not in self._voices:
            raise TtsError(f"Voz Piper desconocida: {voice_id}")
        model_path = self._model_path(voice_id)
        if not model_path.exists():
            raise TtsError(f"Modelo Piper no encontrado: {model_path}")
        return self._synth(model_path, text)

    def _synthesize_with_piper(self, model_path: Path, text: str) -> bytes:
        try:
            from piper import PiperVoice  # type: ignore import-not-found
        except ImportError as exc:  # pragma: no cover - depende del entorno
            raise TtsError(
                "El paquete 'piper-tts' no está instalado en el backend."
            ) from exc

        key = str(model_path)
        voice = self._loaded.get(key)
        if voice is None:
            voice = PiperVoice.load(str(model_path))
            self._loaded[key] = voice

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            voice.synthesize(text, wav_file)
        return buffer.getvalue()
