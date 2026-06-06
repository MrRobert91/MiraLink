from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse, parse_qs

import httpx

from app.services.google_forms import (
    GoogleFormError,
    GoogleFormOption,
    GoogleFormQuestion,
    GoogleFormSubmitResult,
    ImportedGoogleForm,
)


MICROSOFT_FORM_HOSTS = {"forms.office.com", "forms.cloud.microsoft"}


def extract_microsoft_form_id(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host not in MICROSOFT_FORM_HOSTS:
        raise GoogleFormError("La URL no parece pertenecer a Microsoft Forms.")

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 2 and parts[0].lower() in {"r", "e"}:
        return parts[1]

    query = parse_qs(parsed.query)
    for key in ("id", "FormId", "formId"):
        value = query.get(key)
        if value and value[0]:
            return value[0]

    raise GoogleFormError("No se pudo extraer el identificador del formulario de Microsoft Forms.")


def _extract_json_values(html: str) -> list[Any]:
    values: list[Any] = []
    for start_index, char in enumerate(html):
        if char not in "[{":
            continue

        opening = char
        closing = "]" if opening == "[" else "}"
        depth = 0
        in_string = False
        escaped = False
        for index in range(start_index, len(html)):
            current = html[index]
            if in_string:
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == '"':
                    in_string = False
                continue

            if current == '"':
                in_string = True
            elif current == opening:
                depth += 1
            elif current == closing:
                depth -= 1
                if depth == 0:
                    try:
                        values.append(json.loads(html[start_index : index + 1]))
                    except json.JSONDecodeError:
                        pass
                    break
    return values


def _walk(value: Any):
    if isinstance(value, (dict, list)):
        yield value
    if isinstance(value, dict):
        for item in value.values():
            yield from _walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk(item)


def _first_string(node: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = node.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _choice_label(choice: Any) -> str | None:
    if isinstance(choice, str):
        return choice
    if isinstance(choice, dict):
        return _first_string(choice, ("title", "text", "label", "displayText", "name", "Description", "FormsProDisplayRTText"))
    return None


def _question_from_dict(node: dict[str, Any]) -> GoogleFormQuestion | None:
    raw_choices = node.get("choices") or node.get("options") or node.get("answers")
    question_info = node.get("questionInfo")
    parsed_question_info: dict[str, Any] = {}
    if isinstance(question_info, str) and question_info.strip():
        try:
            parsed_question_info = json.loads(question_info)
        except json.JSONDecodeError:
            parsed_question_info = {}

    if (not raw_choices) and isinstance(parsed_question_info.get("Choices"), list):
        raw_choices = parsed_question_info["Choices"]

    if not isinstance(raw_choices, list):
        return None

    labels = [label for label in (_choice_label(choice) for choice in raw_choices) if label]
    if not labels:
        return None

    question_title = _first_string(node, ("title", "questionTitle", "text", "displayText", "name"))
    question_id = _first_string(node, ("id", "questionId", "qid", "itemId"))
    if not question_title or not question_id:
        return None

    raw_type = str(node.get("type") or node.get("questionType") or "").lower()
    if "choice" not in raw_type and "radio" not in raw_type and "checkbox" not in raw_type and "single" not in raw_type and "multi" not in raw_type:
        return None

    choice_type = parsed_question_info.get("ChoiceType")
    allow_multiple = bool(
        node.get("allowMultiple")
        or node.get("isMultipleChoice")
        or choice_type == 2
        or "multi" in raw_type
        or "checkbox" in raw_type
    )

    return GoogleFormQuestion(
        id=question_id,
        entry_id=question_id,
        title=question_title,
        type="checkbox" if allow_multiple else "radio",
        options=[
            GoogleFormOption(
                id=f"{question_id}-{index}",
                label=label,
            )
            for index, label in enumerate(labels)
        ],
    )


def import_microsoft_form_from_runtime_json(form_id: str, data: dict[str, Any]) -> ImportedGoogleForm:
    title = _first_string(data, ("title", "formTitle", "name")) or "Microsoft Forms"
    submit_url = _first_string(data, ("submitUrl", "responsePostUrl", "postUrl", "submitURL")) or ""
    questions: list[GoogleFormQuestion] = []
    seen_questions: set[str] = set()

    sorted_questions = sorted(
        [question for question in data.get("questions", []) if isinstance(question, dict)],
        key=lambda question: (question.get("order") is None, question.get("order", 0)),
    )

    for raw_question in sorted_questions:
        question = _question_from_dict(raw_question)
        if question and question.id not in seen_questions:
            seen_questions.add(question.id)
            questions.append(question)

    if not questions:
        raise GoogleFormError("El formulario de Microsoft no contiene preguntas de opcion compatibles.")

    return ImportedGoogleForm(
        form_id=form_id,
        provider="microsoft",
        title=title,
        submit_url=submit_url,
        questions=questions,
    )


def import_microsoft_form_from_html(form_id: str, html: str) -> ImportedGoogleForm:
    values = _extract_json_values(html)
    title = "Microsoft Forms"
    submit_url = ""
    questions: list[GoogleFormQuestion] = []
    seen_questions: set[str] = set()

    for value in values:
        for node in _walk(value):
            if not isinstance(node, dict):
                continue

            title_candidate = _first_string(node, ("formTitle", "title", "name"))
            if title == "Microsoft Forms" and title_candidate:
                title = title_candidate

            submit_candidate = _first_string(node, ("submitUrl", "responsePostUrl", "postUrl", "submitURL"))
            if not submit_url and submit_candidate:
                submit_url = submit_candidate

            question = _question_from_dict(node)
            if question and question.id not in seen_questions:
                seen_questions.add(question.id)
                questions.append(question)

    if not questions:
        raise GoogleFormError("El formulario de Microsoft no contiene preguntas de opcion compatibles.")

    return ImportedGoogleForm(
        form_id=form_id,
        provider="microsoft",
        title=title,
        submit_url=submit_url,
        questions=questions,
    )


def _extract_prefetch_form_url(html: str) -> str | None:
    match = re.search(r'"prefetchFormUrl"\s*:\s*"(.*?)"', html)
    if not match:
        return None
    raw_value = match.group(1)
    try:
        return json.loads(f'"{raw_value}"')
    except json.JSONDecodeError:
        return raw_value.encode("utf-8").decode("unicode_escape")


def import_microsoft_form(url: str, client: httpx.Client | None = None) -> ImportedGoogleForm:
    form_id = extract_microsoft_form_id(url)
    owns_client = client is None
    http_client = client or httpx.Client(timeout=20.0, follow_redirects=True)
    try:
        response = http_client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        prefetch_url = _extract_prefetch_form_url(response.text)
        if prefetch_url:
            try:
                runtime_response = http_client.get(
                    prefetch_url,
                    headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
                )
                runtime_response.raise_for_status()
                return import_microsoft_form_from_runtime_json(form_id, runtime_response.json())
            except (httpx.HTTPError, ValueError, GoogleFormError):
                pass

        return import_microsoft_form_from_html(form_id, response.text)
    finally:
        if owns_client:
            http_client.close()


def submit_microsoft_form(
    form: ImportedGoogleForm,
    answers: dict[str, list[str]],
    client: httpx.Client | None = None,
) -> GoogleFormSubmitResult:
    if not form.submit_url:
        raise GoogleFormError(
            "Microsoft Forms no expuso un endpoint de envio publico en esta URL. "
            "Prueba con un formulario publico 'Anyone can respond'."
        )

    selected_answers = [
        {"questionId": question_id, "answers": values}
        for question_id, values in answers.items()
        if values
    ]
    if not selected_answers:
        raise GoogleFormError("No hay respuestas seleccionadas para enviar.")

    owns_client = client is None
    http_client = client or httpx.Client(timeout=20.0, follow_redirects=True)
    try:
        response = http_client.post(
            form.submit_url,
            json={"answers": selected_answers},
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        return GoogleFormSubmitResult(
            submitted=response.status_code in {200, 201, 202, 204},
            status_code=response.status_code,
            message="Formulario enviado." if response.status_code in {200, 201, 202, 204} else "Microsoft Forms rechazo el envio.",
        )
    finally:
        if owns_client:
            http_client.close()


def submit_microsoft_form_by_entries(
    submit_url: str,
    answers: dict[str, list[str]],
    client: httpx.Client | None = None,
) -> GoogleFormSubmitResult:
    if not submit_url:
        raise GoogleFormError(
            "Microsoft Forms no expuso un endpoint de envio publico en esta URL. "
            "Prueba con un formulario publico 'Anyone can respond'."
        )

    selected_answers = [
        {"questionId": question_id, "answers": values}
        for question_id, values in answers.items()
        if values
    ]
    if not selected_answers:
        raise GoogleFormError("No hay respuestas seleccionadas para enviar.")

    owns_client = client is None
    http_client = client or httpx.Client(timeout=20.0, follow_redirects=True)
    try:
        response = http_client.post(
            submit_url,
            json={"answers": selected_answers},
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        return GoogleFormSubmitResult(
            submitted=response.status_code in {200, 201, 202, 204},
            status_code=response.status_code,
            message="Formulario enviado." if response.status_code in {200, 201, 202, 204} else "Microsoft Forms rechazo el envio.",
        )
    finally:
        if owns_client:
            http_client.close()
