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
  respuestas y persiste las preferencias del usuario en SQLite.
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
```

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
