FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Binario de Piper + modelos de voz, horneados FUERA de /app/data: el volumen
# persistente se monta sobre /app/data en runtime y taparía cualquier cosa
# colocada ahí. El caché de audios sí vive en el volumen; binario y modelos son
# inmutables y van aquí. Se usa el ejecutable precompilado (sin el paquete pip
# 'piper-tts', cuyas wheels de piper-phonemize no existen para Python 3.12).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && mkdir -p /app/models \
    && curl -fsSL -o /tmp/piper.tar.gz \
        "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz" \
    && tar -xzf /tmp/piper.tar.gz -C /app \
    && rm /tmp/piper.tar.gz \
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
ENV PIPER_BIN=/app/piper/piper
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
