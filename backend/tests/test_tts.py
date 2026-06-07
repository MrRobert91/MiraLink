from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.tts import TtsCache, TtsService, Voice
from app.services.tts.cache import text_hash
from app.services.tts.registry import TtsRegistry, parse_voice_id


class FakeEngine:
    """Motor de prueba que cuenta cuántas veces sintetiza cada texto."""

    name = "fake"

    def __init__(self) -> None:
        self.calls: list[str] = []

    def list_voices(self) -> list[Voice]:
        return [Voice(id="v1", label="Voz de prueba", engine=self.name, lang="es-ES")]

    def synthesize(self, text: str, voice_id: str) -> bytes:
        self.calls.append(text)
        return f"AUDIO::{voice_id}::{text}".encode("utf-8")


def _service(tmp_path: Path, engine: FakeEngine, max_mb: int = 500, ttl_days: int = 120) -> TtsService:
    registry = TtsRegistry()
    registry.register(engine)
    cache = TtsCache(tmp_path / "tts", tmp_path / "tts_cache.db")
    return TtsService(registry, cache, cache_max_mb=max_mb, cache_ttl_days=ttl_days)


def test_parse_voice_id_splits_engine_and_local():
    assert parse_voice_id("piper:es_ES-davefx-medium") == ("piper", "es_ES-davefx-medium")


def test_available_voices_are_qualified_with_engine():
    registry = TtsRegistry()
    registry.register(FakeEngine())
    voices = registry.available_voices()
    assert [v.id for v in voices] == ["fake:v1"]
    assert voices[0].engine == "fake"


def test_prepare_synthesizes_once_and_reuses_cache(tmp_path):
    engine = FakeEngine()
    service = _service(tmp_path, engine)
    items = [("q0", "¿Tienes dolor?"), ("q0:o0", "Sí")]

    first = service.prepare("form-1", "fake:v1", items)
    second = service.prepare("form-1", "fake:v1", items)

    assert set(first) == {"q0", "q0:o0"}
    assert first == second
    # Cada texto se sintetiza una sola vez pese a dos llamadas a prepare.
    assert engine.calls == ["¿Tienes dolor?", "Sí"]


def test_prepare_prunes_audio_when_form_questions_change(tmp_path):
    engine = FakeEngine()
    service = _service(tmp_path, engine)

    service.prepare("form-1", "fake:v1", [("q0", "Pregunta antigua")])
    old_path = service.resolve_audio("form-1", "fake:v1", text_hash("Pregunta antigua"))
    assert old_path is not None and old_path.exists()

    # El formulario cambia: la pregunta antigua debe desaparecer del volumen.
    service.prepare("form-1", "fake:v1", [("q0", "Pregunta nueva")])
    assert service.resolve_audio("form-1", "fake:v1", text_hash("Pregunta antigua")) is None
    assert not old_path.exists()
    assert service.resolve_audio("form-1", "fake:v1", text_hash("Pregunta nueva")) is not None


def test_enforce_limits_evicts_lru_by_size(tmp_path):
    cache = TtsCache(tmp_path / "tts", tmp_path / "tts_cache.db")
    blob = b"x" * (700 * 1024)  # ~0,68 MB por audio
    # Dos audios (~1,37 MB) superan el límite de 1 MB y fuerzan eviction.
    cache.get_or_create("form-1", "fake:v1", "uno", synth=lambda: blob)
    cache.get_or_create("form-1", "fake:v1", "dos", synth=lambda: blob)

    removed = cache.enforce_limits(max_mb=1, ttl_days=0)

    assert removed == 1
    # Se evicta el menos usado recientemente (el primero); el segundo permanece.
    assert cache.resolve("form-1", "fake:v1", text_hash("uno")) is None
    assert cache.resolve("form-1", "fake:v1", text_hash("dos")) is not None


def test_tts_endpoints_prepare_and_serve_audio(tmp_path):
    engine = FakeEngine()
    service = _service(tmp_path, engine)
    client = TestClient(create_app(tts_service=service))

    voices = client.get("/api/tts/voices")
    assert voices.status_code == 200
    assert any(v["id"] == "fake:v1" for v in voices.json())

    prepare = client.post(
        "/api/tts/prepare",
        json={
            "form_id": "form-1",
            "voice_id": "fake:v1",
            "items": [{"key": "q0", "text": "¿Tienes dolor?"}],
        },
    )
    assert prepare.status_code == 200
    url = prepare.json()["items"]["q0"]

    audio = client.get(url)
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/wav"
    assert audio.content == b"AUDIO::v1::\xc2\xbfTienes dolor?"


def test_audio_endpoint_returns_404_for_unknown_hash(tmp_path):
    service = _service(tmp_path, FakeEngine())
    client = TestClient(create_app(tts_service=service))

    response = client.get(
        "/api/tts/audio",
        params={"form_id": "form-1", "voice_id": "fake:v1", "hash": "deadbeef"},
    )
    assert response.status_code == 404
