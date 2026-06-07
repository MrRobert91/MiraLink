FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modelos de voz Piper horneados FUERA de /app/data: el volumen persistente se
# monta sobre /app/data en runtime y taparía cualquier cosa colocada ahí. El
# caché de audios sí vive en el volumen; los modelos son inmutables y van aquí.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && mkdir -p /app/models \
    && curl -fsSL -o /app/models/es_ES-davefx-medium.onnx \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx" \
    && curl -fsSL -o /app/models/es_ES-davefx-medium.onnx.json \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json" \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY app ./app

ENV PYTHONUNBUFFERED=1
ENV PROFILE_DB_PATH=/app/data/profiles.db
ENV TTS_MODELS_DIR=/app/models
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
