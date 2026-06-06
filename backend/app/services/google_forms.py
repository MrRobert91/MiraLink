from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import httpx


class GoogleFormError(ValueError):
    pass


@dataclass(slots=True)
class GoogleFormOption:
    id: str
    label: str


@dataclass(slots=True)
class GoogleFormQuestion:
    id: str
    entry_id: str
    title: str
    type: str
    options: list[GoogleFormOption]


@dataclass(slots=True)
class ImportedGoogleForm:
    form_id: str
    title: str
    submit_url: str
    questions: list[GoogleFormQuestion]
    provider: str = "google"


@dataclass(slots=True)
class GoogleFormSubmitResult:
    submitted: bool
    status_code: int
    message: str


QUESTION_TYPES = {
    2: "radio",
    4: "checkbox",
}


def extract_form_id(url: str) -> str:
    parsed = urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if "forms" not in parts or "d" not in parts:
        raise GoogleFormError("La URL no parece pertenecer a Google Forms.")

    d_index = parts.index("d")
    if len(parts) <= d_index + 1:
        raise GoogleFormError("No se pudo extraer el identificador del formulario.")

    if parts[d_index + 1] == "e":
        if len(parts) <= d_index + 2:
            raise GoogleFormError("No se pudo extraer el identificador publico del formulario.")
        return parts[d_index + 2]

    return parts[d_index + 1]


def _extract_public_load_data(html: str) -> Any:
    marker = "FB_PUBLIC_LOAD_DATA_"
    marker_index = html.find(marker)
    if marker_index < 0:
        raise GoogleFormError("No se encontraron datos publicos del formulario.")

    start = html.find("[", marker_index)
    if start < 0:
        raise GoogleFormError("Los datos publicos del formulario no tienen formato esperado.")

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(html)):
        char = html[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(html[start : index + 1])

    raise GoogleFormError("No se pudo leer el bloque de datos del formulario.")


def _walk_lists(value: Any):
    if isinstance(value, list):
        yield value
        for item in value:
            yield from _walk_lists(item)


def _read_options(entry_payload: Any) -> list[str]:
    if not isinstance(entry_payload, list) or len(entry_payload) < 2:
        return []
    raw_options = entry_payload[1]
    if not isinstance(raw_options, list):
        return []

    labels: list[str] = []
    for option in raw_options:
        if isinstance(option, list) and option and isinstance(option[0], str):
            labels.append(option[0])
        elif isinstance(option, str):
            labels.append(option)
    return labels


def _question_from_node(node: list[Any]) -> GoogleFormQuestion | None:
    if len(node) < 5:
        return None
    if not isinstance(node[0], str) or not isinstance(node[1], str) or not isinstance(node[3], int):
        return None

    question_type = QUESTION_TYPES.get(node[3])
    if not question_type or not isinstance(node[4], list) or not node[4]:
        return None

    entry_payload = node[4][0]
    if not isinstance(entry_payload, list) or not entry_payload or not isinstance(entry_payload[0], int):
        return None

    labels = _read_options(entry_payload)
    if not labels:
        return None

    return GoogleFormQuestion(
        id=node[0],
        entry_id=f"entry.{entry_payload[0]}",
        title=node[1],
        type=question_type,
        options=[GoogleFormOption(id=f"{node[0]}-{index}", label=label) for index, label in enumerate(labels)],
    )


def import_google_form_from_html(form_id: str, html: str) -> ImportedGoogleForm:
    data = _extract_public_load_data(html)
    title = data[1][1] if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list) and len(data[1]) > 1 else "Formulario"
    questions: list[GoogleFormQuestion] = []
    seen_entries: set[str] = set()

    for node in _walk_lists(data):
        question = _question_from_node(node)
        if question and question.entry_id not in seen_entries:
            seen_entries.add(question.entry_id)
            questions.append(question)

    if not questions:
        raise GoogleFormError("El formulario no contiene preguntas de opcion multiple o casillas compatibles.")

    return ImportedGoogleForm(
        form_id=form_id,
        title=title,
        submit_url=f"https://docs.google.com/forms/d/e/{form_id}/formResponse",
        questions=questions,
    )


def import_google_form(url: str, client: httpx.Client | None = None) -> ImportedGoogleForm:
    form_id = extract_form_id(url)
    owns_client = client is None
    http_client = client or httpx.Client(timeout=20.0, follow_redirects=True)
    try:
        response = http_client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        return import_google_form_from_html(form_id, response.text)
    finally:
        if owns_client:
            http_client.close()


def submit_google_form_by_entries(
    submit_url: str,
    answers: dict[str, list[str]],
    client: httpx.Client | None = None,
) -> GoogleFormSubmitResult:
    payload: list[tuple[str, str]] = []
    for entry_id, values in answers.items():
        for value in values:
            payload.append((entry_id, value))

    if not payload:
        raise GoogleFormError("No hay respuestas seleccionadas para enviar.")

    owns_client = client is None
    http_client = client or httpx.Client(timeout=20.0, follow_redirects=True)
    try:
        response = http_client.post(
            submit_url,
            content=urlencode(payload),
            headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
        )
        return GoogleFormSubmitResult(
            submitted=response.status_code in {200, 302},
            status_code=response.status_code,
            message="Formulario enviado." if response.status_code in {200, 302} else "Google Forms rechazo el envio.",
        )
    finally:
        if owns_client:
            http_client.close()


def answers_from_query_string(raw: str) -> dict[str, list[str]]:
    return {key: values for key, values in parse_qs(raw, keep_blank_values=True).items() if re.match(r"^[\w-]+$", key)}
