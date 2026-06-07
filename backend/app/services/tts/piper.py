from __future__ import annotations

import os
import subprocess
import tempfile
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
    """Motor TTS basado en el binario precompilado de Piper.

    Usa el ejecutable de Piper (sin dependencias de Python) invocado por
    subprocess: `PIPER_BIN --model <modelo> --output_file <wav>` con el texto por
    stdin. Solo anuncia las voces cuyo modelo `.onnx` existe en `models_dir`, de
    modo que la imagen sin modelos degrada de forma elegante (catálogo vacío).
    """

    name = "piper"

    def __init__(
        self,
        models_dir: Path | str,
        voices: list[PiperVoiceConfig] | None = None,
        binary_path: str | None = None,
        synth: Callable[[Path, str], bytes] | None = None,
    ) -> None:
        self._models_dir = Path(models_dir)
        self._voices = {v.id: v for v in (voices if voices is not None else DEFAULT_PIPER_VOICES)}
        self._binary_path = binary_path or os.getenv("PIPER_BIN", "piper")
        # `synth` se inyecta en tests; en producción usa el binario de Piper.
        self._synth = synth or self._synthesize_with_piper

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
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            output_path = Path(handle.name)
        try:
            try:
                result = subprocess.run(
                    [self._binary_path, "--model", str(model_path), "--output_file", str(output_path)],
                    input=text.encode("utf-8"),
                    capture_output=True,
                )
            except FileNotFoundError as exc:  # pragma: no cover - depende del entorno
                raise TtsError(
                    f"No se encontró el binario de Piper ('{self._binary_path}')."
                ) from exc
            if result.returncode != 0:
                detail = result.stderr.decode("utf-8", "ignore").strip()[:300]
                raise TtsError(f"Piper falló (código {result.returncode}): {detail}")
            return output_path.read_bytes()
        finally:
            output_path.unlink(missing_ok=True)
