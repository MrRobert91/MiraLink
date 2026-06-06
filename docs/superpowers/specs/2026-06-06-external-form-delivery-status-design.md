# Estado de entrega de formularios externos

## Objetivo

Guardar siempre las respuestas en la base de datos local aunque Google Forms o
Microsoft Forms rechacen el envío o no estén disponibles, y conservar el
resultado del envío externo sin crear respuestas duplicadas durante reintentos.

## Flujo

1. El backend crea el registro local con estado externo `pending`.
2. El backend intenta enviar las respuestas al proveedor externo.
3. El mismo registro se actualiza a `sent` o `failed`.
4. La API devuelve el identificador local y el resultado externo.
5. Si el usuario reintenta, el frontend envía ese identificador y el backend
   actualiza el mismo registro y sus respuestas.

El guardado local es el requisito principal. Un fallo externo devuelve HTTP 200
con `saved: true` y `submitted: false`. Un fallo del guardado local sí devuelve
un error HTTP y no se intenta afirmar que las respuestas están guardadas.

## Persistencia

`form_submissions` incorpora:

- `external_status`: `pending`, `sent` o `failed`.
- `external_status_code`: código HTTP del proveedor cuando esté disponible.
- `external_message`: mensaje seguro para mostrar y auditar.
- `external_attempted_at`: fecha del último intento externo.

La inicialización de SQLite migrará bases existentes con `ALTER TABLE` cuando
falten columnas. Los registros históricos se marcarán como `unknown`, ya que no
se puede reconstruir de forma fiable si llegaron al proveedor.

`record_submission` aceptará opcionalmente un `submission_id`. Cuando exista,
actualizará los metadatos del registro y reemplazará sus respuestas dentro de
una transacción. Cuando no exista, creará un registro nuevo.

## API

`POST /api/forms/submit` aceptará `submission_id` opcional y responderá:

- `submission_id`
- `saved`
- `submitted`
- `status_code`
- `message`

Tras guardar, cualquier resultado normal del proveedor actualiza el registro.
Las excepciones conocidas o inesperadas también se convierten en estado
`failed`, se actualiza el registro y se responde HTTP 200. No se exponen
detalles sensibles de excepciones inesperadas.

## Frontend

El flujo conservará el `submission_id` devuelto por el primer intento y lo
incluirá en reintentos. Solo marcará el formulario como enviado cuando
`submitted` sea verdadero. Si falla el proveedor, informará que las respuestas
se guardaron localmente y permitirá volver a pulsar el botón.

El panel administrativo mostrará una columna de estado externo con valores
enviado, fallido, pendiente o desconocido. El CSV incluirá los campos de estado
externo para permitir auditoría fuera de la aplicación.

## Pruebas

- Migración de una base SQLite existente.
- Creación, actualización y ausencia de duplicados en el almacén.
- Éxito externo, rechazo normal y excepción del proveedor en la API.
- Contrato frontend con `submission_id`.
- Renderizado de estados en el panel administrativo.

