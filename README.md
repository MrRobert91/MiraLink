# MiraLink

Aplicación web para **responder formularios de Google Forms y Microsoft Forms
controlando la pantalla únicamente con la mirada**, pensada para personas con
movilidad reducida severa. Usa eye tracking con una webcam estándar (MediaPipe
en el navegador), un proceso de calibración guiado y zonas de decisión binarias
(Sí / No) que se activan por permanencia de la mirada (dwell).

## Documentación del proyecto

- [PRD + Arquitectura + Backlog](./PRD_ARQUITECTURA_BACKLOG.md) (documento histórico; describe el proyecto original AAC del que parte MiraLink)

## Estructura del monorepo

- `frontend/`: aplicación React + Vite. Eye tracking con MediaPipe, calibración,
  control por mirada e importación/envío de formularios.
- `backend/`: API FastAPI. Importa y envía formularios externos, guarda las
  respuestas, persiste las preferencias del usuario en SQLite y genera/cachea
  los audios de lectura en voz alta (TTS de backend tipo Piper).
- `docker-compose.yml`: orquestación local de ambos servicios.

## Flujo de la aplicación

1. El usuario calibra la mirada con la webcam.
2. Importa un formulario por URL (Google Forms o Microsoft Forms).
3. Responde cada pregunta binaria mirando a la zona Sí / No.
4. Las respuestas se guardan localmente y se reenvían al formulario original.
5. El panel de administración permite revisar y exportar las respuestas a CSV.

## API del backend

- `GET /health`
- `GET /api/profiles/{user_id}` · `PUT /api/profiles/{user_id}` — preferencias del usuario
- `POST /api/forms/import` — importa un formulario (detecta proveedor por la URL)
- `POST /api/forms/submit` — guarda y reenvía las respuestas
- `GET /api/forms/saved` · `POST /api/forms/saved` · `DELETE /api/forms/saved` — formularios guardados
- `GET /api/admin/submissions` · `GET /api/admin/submissions/{id}` · `GET /api/admin/submissions/export/csv`
- `GET /api/tts/voices` — catálogo de voces de backend disponibles (p. ej. Piper)
- `POST /api/tts/prepare` — genera/reutiliza los audios de un formulario y devuelve sus URLs
- `GET /api/tts/audio` — sirve un audio cacheado (`form_id`, `voice_id`, `hash`)

## Arranque rápido

### Con Docker

```bash
docker compose up --build
```

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

### Frontend local

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
npm test
```

### Backend local

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

## Configuración

Frontend (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:8000
```

Backend (`backend/.env`):

```env
ALLOWED_ORIGINS=*
PROFILE_DB_PATH=data/profiles.db
RESPONSES_DB_PATH=data/form_responses.db

# Lectura en voz alta (TTS) con motores de backend tipo Piper
TTS_MODELS_DIR=models
TTS_CACHE_DIR=data/tts
TTS_CACHE_DB_PATH=data/tts_cache.db
TTS_CACHE_MAX_MB=500
TTS_CACHE_TTL_DAYS=120
```

## Lectura en voz alta (text-to-speech)

MiraLink puede leer cada pregunta y opción en voz alta mientras se muestran.
Mientras suena la locución, la selección por mirada (dwell) se **congela** para
que el usuario pueda escuchar sin elegir sin querer.

Se activa en **Configuración → Lectura en voz alta** y admite dos tipos de voz:

- **Voces del navegador** (Web Speech API): coste cero, sin red ni persistencia
  y privacidad total (nada sale del dispositivo). Su calidad y disponibilidad
  dependen del sistema operativo; si el navegador no expone ninguna voz, la
  pantalla de ajustes lo avisa y se puede usar una voz de backend.
- **Voces de backend** (Piper, self-hosted): calidad consistente en cualquier
  dispositivo, también local (no se envía texto a terceros). Al cargar un
  formulario se generan los audios de cada pregunta/opción y se **cachean en el
  volumen** del backend, organizados por formulario. Mientras el formulario y
  sus textos no cambien, los audios se reutilizan sin volver a llamar al modelo.

El modelo Piper por defecto (`es_ES-davefx-medium`) se hornea en la imagen del
backend (`docker compose build backend`); fuera de Docker, sin el `.onnx`
correspondiente, `GET /api/tts/voices` devuelve una lista vacía y la app usa las
voces del navegador.

### Caché de audios

- Ubicación: `TTS_CACHE_DIR/forms/<form_id>/<voice_id>/<hash_texto>.wav`, indexada
  en SQLite (`TTS_CACHE_DB_PATH`), ambos dentro del volumen persistente.
- Reutilización por hash del texto normalizado: si una pregunta cambia, solo se
  regenera ese audio; los audios obsoletos del formulario se eliminan.
- Eviction automática: por antigüedad (`TTS_CACHE_TTL_DAYS`) y por tamaño total
  (LRU hasta `TTS_CACHE_MAX_MB`).

### Añadir voces o motores nuevos

La síntesis de backend está detrás de una interfaz enchufable
(`backend/app/services/tts/`). Ni la API ni el frontend necesitan cambios: las
voces nuevas aparecen solas en el selector de Ajustes.

- **Otra voz de Piper**: descarga su `.onnx` (+ `.onnx.json`) a `TTS_MODELS_DIR`
  (en Docker, `/app/models`; ver el `Dockerfile`) y añade su entrada a
  `DEFAULT_PIPER_VOICES` en [`piper.py`](backend/app/services/tts/piper.py). Solo
  se anuncian las voces cuyo modelo existe en disco.
- **Otro motor** (Kokoro, KittenTTS, …): implementa la interfaz `TtsEngine`
  (`name`, `list_voices()`, `synthesize()`) en un módulo nuevo y regístralo en
  `build_default_registry` de
  [`registry.py`](backend/app/services/tts/registry.py). Hay un esqueleto de
  ejemplo en [`kokoro.py`](backend/app/services/tts/kokoro.py).

## Despliegue con hosts públicos separados

Frontend:

```env
VITE_API_BASE_URL=https://tu-backend-publico.example.com
```

Backend (si necesitas varios orígenes, sepáralos por comas):

```env
ALLOWED_ORIGINS=https://tu-frontend-publico.example.com
```

El contenedor nginx del frontend inyecta `VITE_API_BASE_URL` en runtime en
`/env-config.js`, y la SPA la lee al cargar.
