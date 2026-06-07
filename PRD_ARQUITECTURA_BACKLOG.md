# PRD + Arquitectura + Backlog Técnico

> ⚠️ **Documento histórico.** Describe el proyecto original **EyeSpeak Gemma**:
> un comunicador AAC de eye-typing con predicción Gemma y TTS. El producto pivotó
> a **MiraLink**, una app para **responder Google Forms y Microsoft Forms con la
> mirada**, y la maquinaria de predicción/voz/sesiones se ha eliminado del código.
> Para el estado actual consulta el [README](./README.md). Se conserva este
> documento como contexto del diseño de eye tracking, calibración y accesibilidad,
> que siguen vigentes.

## Proyecto

**Nombre de trabajo:** MiraLink (originalmente EyeSpeak Gemma)

**Resumen:** Aplicación web que permite a personas con movilidad reducida severa
**responder formularios de Google Forms y Microsoft Forms usando solo la mirada**,
mediante eye tracking con webcam estándar, calibración guiada y zonas de decisión
binarias activadas por permanencia (dwell). Las secciones siguientes describen el
concepto AAC original (teclado virtual, predicción y TTS) y se mantienen como
referencia histórica.

**Contexto del hackathon:** Proyecto orientado a la `Gemma 4 Good Hackathon` de Kaggle, con foco principal en `Digital Equity & Inclusivity` y secundarios en `Safety & Trust` y `Health`.

## 1. Visión del producto

### Problema

Muchas personas que dependen de sistemas AAC o de entrada asistiva no tienen acceso a eye trackers dedicados por coste, disponibilidad o complejidad de configuración. Existen soluciones con hardware especializado, pero no siempre son accesibles, portables o fáciles de desplegar.

### Oportunidad

Una webcam convencional está ampliamente disponible en portátiles, tablets y equipos de sobremesa. Si combinamos:

- seguimiento ocular con webcam
- calibración robusta
- teclado virtual optimizado para mirada
- predicción lingüística en tiempo real
- síntesis de voz natural

podemos ofrecer una herramienta útil, de bajo coste y fácil de desplegar desde navegador.

### Propuesta de valor

EyeSpeak Gemma permite:

- escribir usando solo la mirada
- reducir el número de fijaciones necesarias con predicción inteligente
- hablar en voz alta con una voz natural
- funcionar con hardware corriente y arquitectura `local-first`
- preservar privacidad al no necesitar enviar vídeo crudo al backend

## 2. Objetivos del proyecto

### Objetivo principal

Construir una demo funcional y convincente de una web AAC basada en mirada que demuestre impacto real, viabilidad técnica y uso significativo de Gemma 4.

### Objetivos de producto

- Permitir escritura hands-free con webcam normal.
- Minimizar errores y fatiga en la selección por mirada.
- Mejorar la fluidez con predicción de siguiente palabra en tiempo real.
- Convertir texto escrito en audio comprensible con TTS de Google.
- Personalizar vocabulario y sugerencias por usuario.

### Objetivos de hackathon

- Mostrar un caso de impacto social claro y defendible.
- Enseñar uso útil de Gemma 4, no cosmético.
- Tener una demo corta, estable y fácil de entender.
- Presentar arquitectura realista y escalable.

## 3. Qué papel juega Gemma 4

Gemma 4 no debe usarse como simple chatbot lateral. Debe aportar valor central al flujo de comunicación.

### Uso principal de Gemma 4

- Reordenar y mejorar predicciones de siguiente palabra.
- Sugerir completado de frase con contexto.
- Adaptar sugerencias al historial y al contexto conversacional.
- Soportar varios idiomas y registros lingüísticos.
- Generar frases rápidas contextuales a partir de intención breve.

### Uso secundario de Gemma 4

- Ajuste del vocabulario personalizado del usuario.
- Expansión de abreviaturas.
- Sugerencias por contexto visual en una futura fase multimodal.

### Estrategia recomendada

Usar un predictor híbrido:

- Capa 1 rápida: reglas, n-gramas, historial y phrase bank.
- Capa 2 inteligente: Gemma 4 rerankeando o completando cuando haya suficiente contexto.

Esto permite mantener latencia baja y, al mismo tiempo, enseñar una integración real con Gemma 4.

## 4. Usuarios objetivo

### Usuario primario

Persona con movilidad muy reducida que conserva control ocular funcional y necesita un sistema de comunicación aumentativa o alternativa.

### Usuario secundario

- familiar o cuidador
- terapeuta ocupacional o logopeda
- clínico o investigador de accesibilidad

### Necesidades clave

- baja carga cognitiva
- alta legibilidad
- tolerancia a errores
- respuesta rápida
- configuración simple
- feedback claro y predecible

## 5. Alcance del MVP

### Incluido en MVP

- calibración ocular básica con webcam
- teclado virtual optimizado para mirada
- selección por `dwell time`
- barra de predicción de palabras en tiempo real
- edición básica: espacio, borrar carácter, borrar palabra, confirmar frase
- reproducción TTS de la frase actual
- historial de frases recientes
- ajustes mínimos de accesibilidad
- backend Python para predicción, sesiones y TTS

### Deseable si entra en tiempo

- perfiles de usuario
- aprendizaje personalizado de vocabulario
- frases rápidas por categorías
- soporte bilingüe ES/EN
- métricas de velocidad y tasa de error
- modo de comandos con `smooth pursuit` para acciones grandes

### Fuera del MVP

- certificación clínica
- precisión comparable a eye trackers IR dedicados
- uso hospitalario sin validación
- control total del sistema operativo

## 6. Requisitos funcionales

### RF-01. Captura y seguimiento ocular

El sistema debe capturar vídeo desde webcam estándar y estimar mirada en tiempo real a nivel suficiente para selección por zonas de teclado.

### RF-02. Calibración

El sistema debe ofrecer una calibración guiada de 9 o 16 puntos y recalibración rápida.

### RF-03. Escritura por mirada

El usuario debe poder seleccionar teclas mediante fijación con `dwell time` configurable y feedback visual de progreso.

### RF-04. Predicción en tiempo real

El sistema debe mostrar hasta 3 a 5 sugerencias de siguiente palabra o completado con latencia baja.

### RF-05. Personalización

El sistema debe aprender del historial reciente del usuario para priorizar términos frecuentes.

### RF-06. Voz

El usuario debe poder pulsar con la mirada un botón de hablar para sintetizar la frase actual con Google TTS.

### RF-07. Frases rápidas

El sistema debe ofrecer acceso rápido a frases recurrentes, por ejemplo: saludo, dolor, agua, ayuda, sí, no.

### RF-08. Accesibilidad

La interfaz debe incluir:

- alto contraste
- teclas grandes
- indicador de foco
- dwell configurable
- velocidad de animación reducida

### RF-09. Privacidad

El vídeo crudo no debe salir del navegador salvo decisión explícita futura para investigación.

## 7. Requisitos no funcionales

### RNF-01. Latencia

- objetivo de UI: menos de `50 ms` para feedback visual local
- objetivo de predicción rápida: menos de `150 ms`
- objetivo de TTS bajo demanda: respuesta percibida menor de `1.5 s`

### RNF-02. Robustez

El sistema debe seguir siendo utilizable con cambios moderados de iluminación y con pequeñas variaciones de postura.

### RNF-03. Seguridad y confianza

- no activar habla automáticamente sin confirmación explícita
- mostrar siempre la frase final antes de reproducir
- dejar claro cuando una sugerencia es inferida por IA

### RNF-04. Portabilidad

La aplicación debe funcionar en navegador moderno de escritorio, priorizando Chrome y Edge.

### RNF-05. Observabilidad

Registrar eventos agregados y métricas de interacción sin almacenar vídeo.

## 8. Investigación de interacción ocular y decisión de diseño

## 8.1 Opciones de control con la mirada usando webcam normal

### A. Dwell time sobre objetivos estáticos

**Qué es:** seleccionar un elemento manteniendo la mirada fijada durante un tiempo.

**Ventajas:**

- simple
- robusto con precisión moderada
- intuitivo para teclado virtual

**Inconvenientes:**

- riesgo de `Midas touch`
- puede resultar lento si el dwell es excesivo

**Veredicto:** debe ser el método principal del MVP.

### B. Parpadeo intencional para confirmar

**Qué es:** usar blink prolongado o patrón de blink como clic.

**Ventajas:**

- reduce activaciones accidentales en algunos contextos

**Inconvenientes:**

- fatiga
- falsos positivos
- no todas las personas pueden usarlo de forma consistente

**Veredicto:** solo como mecanismo opcional secundario.

### C. Smooth pursuit

**Qué es:** seguir con la mirada un objetivo animado para activar un comando.

**Ventajas:**

- mitiga `Midas touch`
- menos dependencia de calibración fina

**Inconvenientes:**

- peor para teclados densos
- mayor complejidad de UX

**Veredicto:** adecuado para acciones grandes como `Hablar`, `Borrar`, `Pausar`, `Recalibrar`.

### D. Escaneo por filas y columnas

**Qué es:** el sistema va resaltando grupos y el usuario selecciona con dwell o confirmación.

**Ventajas:**

- más tolerante a tracking impreciso
- útil como fallback

**Inconvenientes:**

- más lento
- peor experiencia para conversación fluida

**Veredicto:** buen modo de respaldo para baja calidad de tracking.

## 8.2 Decisión

La interacción recomendada para el proyecto es:

- **principal:** `dwell time adaptativo`
- **secundaria:** `smooth pursuit` para comandos globales
- **fallback:** `escaneo por grupos`

## 9. Arquitectura de alto nivel

## 9.1 Vista general

```text
Webcam
  -> Frontend Web
  -> MediaPipe Face/Iris
  -> Estimación de mirada + calibración
  -> Motor local de selección
  -> UI teclado virtual
  -> WebSocket/HTTP
  -> Backend FastAPI
      -> Predictor híbrido
      -> Servicio Gemma 4
      -> Memoria de usuario
      -> TTS Google
      -> Métricas
```

## 9.2 Principios de arquitectura

- `local-first` para vídeo y gaze pipeline
- backend desacoplado para inteligencia lingüística
- degradación elegante si Gemma o TTS no están disponibles
- componentes sustituibles para experimentación rápida

## 10. Arquitectura frontend

### Stack recomendado

- `Next.js` o `React + Vite`
- TypeScript
- WebRTC / `getUserMedia` para webcam
- MediaPipe Tasks Vision para landmarks faciales
- Canvas/SVG para overlays de calibración y gaze cursor

### Módulos frontend

#### 1. Camera Manager

- pide permisos
- gestiona stream de webcam
- controla resolución y FPS

#### 2. Gaze Engine

- recibe landmarks faciales e iris
- calcula features por frame
- estima `head pose`
- aplica suavizado temporal
- proyecta mirada sobre plano de pantalla

#### 3. Calibration Engine

- ejecuta rutina 9/16 puntos
- almacena pares `features -> target`
- entrena mapeo por sesión
- reevalúa error de calibración

#### 4. Selection Engine

- determina tecla focalizada
- aplica dwell time
- evita activaciones involuntarias
- resuelve key snapping

#### 5. Keyboard UI

- layout del teclado
- barra de sugerencias
- frases rápidas
- feedback de selección

#### 6. Accessibility Settings

- tamaño de tecla
- dwell configurable
- modo alto contraste
- sensibilidad y suavizado

## 11. Arquitectura de eye tracking con webcam

### Pipeline recomendado

#### Paso 1. Detección facial e iris

Usar `MediaPipe Face Landmarker` y landmarks de ojos/iris por rendimiento y portabilidad.

#### Paso 2. Extracción de features

Por frame:

- centro del iris izquierdo y derecho
- contornos de ojos
- apertura palpebral
- orientación de cabeza aproximada
- distancia cara-cámara estimada
- posición facial normalizada

#### Paso 3. Normalización

Normalizar frente a:

- tamaño del rostro en imagen
- rotación de cabeza
- distancia a cámara
- cambios pequeños de postura

#### Paso 4. Calibración supervisada corta

Recoger muestras con targets conocidos en la pantalla y entrenar un mapeo ligero:

- opción inicial: regresión ridge
- alternativa: pequeño MLP

#### Paso 5. Suavizado temporal

Aplicar:

- moving average exponencial
- filtro de velocidad
- supresión de jitter

#### Paso 6. Target inference

Convertir punto de mirada a:

- coordenada continua
- tecla o zona focalizada
- nivel de confianza

### Enfoque recomendado para MVP

No perseguir cursor libre preciso. Diseñar el teclado para selección por zonas grandes y `snapping` a teclas cercanas.

## 12. Arquitectura backend

### Stack recomendado

- Python 3.11+
- FastAPI
- Uvicorn
- Pydantic
- Redis opcional para caché
- SQLite para demo local o Postgres para despliegue serio

### Servicios backend

#### 1. Prediction Service

Responsable de devolver sugerencias rápidas dado el contexto actual.

Entradas:

- texto ya escrito
- idioma
- perfil de usuario

Salidas:

- top N palabras sugeridas
- top N frases sugeridas
- metadatos de confianza y fuente

#### 2. Gemma Service

Encapsula inferencia sobre Gemma 4.

Usos:

- reranking de sugerencias
- completado contextual
- expansión de intención breve a frase natural

Despliegue posible:

- local en GPU
- servidor dedicado
- endpoint compatible OpenAI/vLLM si se necesita velocidad de integración

#### 3. User Memory Service

Guarda:

- palabras frecuentes
- frases frecuentes
- idioma preferido
- últimas sesiones

#### 4. TTS Service

Conecta con Google Cloud Text-to-Speech para reproducir la frase final.

#### 5. Analytics Service

Métricas agregadas:

- tiempo por selección
- error de selección
- uso de sugerencias
- tasa de frases habladas

## 13. Diseño del predictor híbrido

### Objetivo

Dar sugerencias útiles en tiempo real sin depender completamente de una llamada generativa lenta.

### Capa rápida

Implementar:

- trie por prefijo
- frecuencia global
- frecuencia por usuario
- n-gramas simples
- phrase bank por dominio AAC

### Capa Gemma 4

Usar Gemma 4 para:

- rerank de candidatos
- predicción contextual de siguiente palabra
- completado de frase al final de una oración incompleta

### Flujo recomendado

1. El frontend envía el contexto textual actual.
2. El backend genera candidatos baratos.
3. Si el contexto es suficiente, Gemma rerankea o amplía.
4. Se devuelven sugerencias con marca de origen:
   - `history`
   - `ngram`
   - `gemma`

### Modelos recomendados

#### Opción MVP equilibrada

- `Gemma 4 E4B-it`

Motivo:

- menor latencia
- menor coste computacional
- suficiente para predicción lingüística y reranking

#### Opción demo potente

- `Gemma 4 26B`

Motivo:

- mejores sugerencias contextuales
- mejor storytelling de hackathon

#### No recomendado como base del tiempo real

- usar solo un modelo grande generando en cada pulsación

## 14. Integración TTS

### Opción recomendada

Google Cloud Text-to-Speech.

### Flujo

1. El usuario redacta una frase.
2. Pulsa `Hablar` con la mirada.
3. Se envía la frase final al backend.
4. El backend solicita audio a Google TTS.
5. El frontend reproduce el audio.

### Consideraciones

- no hablar automáticamente cada cambio
- mostrar siempre el texto final
- cachear frases frecuentes si compensa

## 15. API inicial propuesta

### `POST /api/predict`

Request:

```json
{
  "text": "quiero agua",
  "language": "es",
  "user_id": "demo-user"
}
```

Response:

```json
{
  "suggestions": [
    { "text": "por", "source": "gemma", "score": 0.91 },
    { "text": "ahora", "source": "history", "score": 0.84 },
    { "text": "fria", "source": "ngram", "score": 0.79 }
  ]
}
```

### `POST /api/tts`

Request:

```json
{
  "text": "Necesito ayuda, por favor.",
  "language": "es-ES",
  "voice": "default"
}
```

Response:

```json
{
  "audio_url": "/api/audio/12345.mp3"
}
```

### `POST /api/events`

Para registrar eventos agregados de UX y rendimiento.

## 16. Modelo de datos inicial

### Tabla `users`

- id
- display_name
- preferred_language
- created_at

### Tabla `phrases`

- id
- user_id
- text
- usage_count
- last_used_at

### Tabla `lexicon_entries`

- id
- user_id
- token
- frequency
- updated_at

### Tabla `sessions`

- id
- user_id
- started_at
- ended_at
- calibration_score

## 17. UX y diseño del teclado

### Decisiones clave

- teclas grandes y espaciadas
- pocas acciones críticas por pantalla
- sugerencias arriba, teclado centro, acciones abajo
- colores de alto contraste
- progreso circular de dwell

### Layout recomendado

- fila superior: frase actual + botón `Hablar`
- fila secundaria: 3 a 5 sugerencias
- zona central: teclado QWERTY simplificado o por frecuencia
- zona inferior: espacio, borrar, frases rápidas, recalibrar

### Consideración importante

Un teclado convencional completo puede ser demasiado denso. Conviene evaluar:

- `QWERTY simplificado`
- teclado por grupos frecuentes
- layout adaptado por idioma

Para MVP, usar `QWERTY grande + snapping`.

## 18. Seguridad, privacidad y ética

### Riesgos

- falsas activaciones
- frases sugeridas incorrectas
- confianza excesiva en la IA
- almacenamiento excesivo de datos sensibles

### Medidas

- confirmación explícita antes de hablar
- marca visible de sugerencias IA
- no almacenar vídeo
- opción de limpiar historial
- logging minimizado

## 19. Métricas de éxito

### Métricas de producto

- tiempo medio por carácter
- tiempo medio por palabra
- ratio de uso de predicciones
- reducción de fijaciones por frase
- tasa de error de selección
- tiempo hasta hablar una frase completa

### Métricas para la demo

- completar una frase funcional en menos de 30 segundos
- usar al menos una sugerencia predictiva por frase
- reproducir audio final con éxito en más del 95% de intentos de demo

## 20. Roadmap por fases

### Fase 0. Base técnica

- preparar repo y estructura frontend/backend
- levantar captura de webcam
- integrar MediaPipe
- dibujar overlay de landmarks

### Fase 1. Eye typing básico

- calibración 9 puntos
- estimación de mirada
- selección con dwell
- teclado virtual básico

### Fase 2. Comunicación útil

- frase actual editable
- sugerencias simples locales
- botón de hablar con TTS
- frases rápidas

### Fase 3. Inteligencia Gemma

- servicio de predicción híbrido
- reranking con Gemma 4
- personalización por usuario

### Fase 4. Pulido para hackathon

- métricas
- modo demo estable
- video/script de presentación
- landing explicativa y narrativa de impacto

## 21. Backlog técnico priorizado

## P0 - Imprescindible

- Definir monorepo o estructura `frontend/` y `backend/`.
- Crear aplicación frontend base con captura webcam.
- Integrar MediaPipe Face Landmarker.
- Implementar overlay de ojos/iris para depuración.
- Implementar rutina de calibración 9 puntos.
- Implementar mapeo mirada -> coordenada pantalla.
- Implementar suavizado temporal.
- Implementar teclado virtual grande con dwell.
- Implementar buffer de texto y controles básicos.
- Crear backend FastAPI.
- Crear endpoint `/api/predict` con predictor local simple.
- Crear endpoint `/api/tts`.
- Integrar Google Cloud TTS.
- Añadir barra de sugerencias en frontend.
- Añadir frase actual y botón `Hablar`.

## P1 - Muy importante

- Historial de palabras y frases por usuario.
- Personalización de ranking de sugerencias.
- Recalibración rápida.
- Snapping inteligente a teclas.
- Ajustes de dwell y contraste.
- Métricas de selección y latencia.
- Integrar Gemma 4 E4B-it para reranking.
- Añadir frases rápidas por categorías.

## P2 - Diferenciación

- Soporte bilingüe ES/EN.
- Smooth pursuit para botones globales.
- Modo fallback por escaneo.
- Expansión de abreviaturas con Gemma.
- Generación de frases rápidas contextuales.
- Panel clínico/caregiver básico.

## P3 - Post-hackathon

- Perfiles persistentes multiusuario.
- Evaluación con usuarios reales y terapeutas.
- Mejoras del modelo de calibración.
- Despliegue edge/on-device.
- Modo offline parcial con TTS local alternativo.

## 22. Sprint sugerido de 2 semanas

## Semana 1

- Día 1: estructura del proyecto y webcam
- Día 2: landmarks e iris en navegador
- Día 3: calibración y visualización gaze
- Día 4: teclado virtual + dwell
- Día 5: backend FastAPI + predictor local simple
- Día 6: integración TTS + flujo completo
- Día 7: estabilización de demo básica

## Semana 2

- Día 8: historial y personalización
- Día 9: integración Gemma 4 para reranking
- Día 10: mejoras UX y accesibilidad
- Día 11: métricas y telemetría mínima
- Día 12: frases rápidas y pulido
- Día 13: ensayo de demo y corrección de latencias
- Día 14: vídeo, capturas, submission package

## 23. Riesgos técnicos y mitigación

### Riesgo 1. Precisión insuficiente con webcam

**Mitigación:**

- usar teclas grandes
- snapping
- calibración guiada
- fallback por escaneo

### Riesgo 2. Latencia del predictor

**Mitigación:**

- predictor híbrido
- caché
- Gemma solo para rerank/completion

### Riesgo 3. Iluminación y gafas

**Mitigación:**

- guías visuales de colocación
- feedback de calidad de tracking
- recalibración simple

### Riesgo 4. Demo frágil

**Mitigación:**

- modo demo con condiciones controladas
- script de uso corto
- frase preparada para mostrar impacto

## 24. Criterios de aceptación del MVP

- El usuario puede completar una frase simple usando solo la mirada.
- El usuario puede aceptar al menos una sugerencia de palabra.
- El sistema puede leer la frase en voz alta.
- La experiencia es estable en una webcam estándar bajo condiciones razonables.
- La demo muestra de forma clara dónde aporta valor Gemma 4.

## 25. Decisiones abiertas

- elegir `Next.js` o `Vite + React`
- definir si Gemma corre local o en servidor
- decidir layout final del teclado
- escoger voz exacta de TTS
- decidir si habrá login o perfil demo local

## 26. Siguiente implementación recomendada

Orden de construcción recomendado:

1. frontend con webcam + MediaPipe
2. calibración + gaze mapping
3. teclado + dwell
4. FastAPI + predictor simple
5. TTS
6. Gemma 4
7. personalización y pulido demo

## 27. Estado del documento

Este fichero debe tratarse como documento vivo. Cada vez que cambie una decisión de arquitectura, alcance, UX o roadmap, actualizar primero este documento y luego la implementación.
