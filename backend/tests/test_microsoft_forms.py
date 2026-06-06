import logging
import json
from datetime import datetime

import httpx
import pytest

from app.services.microsoft_forms import (
    extract_microsoft_form_id,
    import_microsoft_form,
    import_microsoft_form_from_html,
    import_microsoft_form_from_runtime_json,
    submit_microsoft_form,
    submit_microsoft_form_by_entries,
)


SAMPLE_MICROSOFT_HTML = """
<html>
  <head>
    <script>
      window.__MS_FORMS_BOOTSTRAP__ = {
        "formId": "ms-form-123",
        "title": "Revision diaria",
        "submitUrl": "https://forms.office.com/formapi/api/demo/forms('ms-form-123')/responses",
        "questions": [
          {
            "id": "q1",
            "title": "Como estas?",
            "type": "Choice",
            "allowMultiple": true,
            "choices": [{"id": "a", "title": "Tengo sed"}, {"id": "b", "title": "Tengo frio"}]
          },
          {
            "id": "q2",
            "title": "Quieres descansar?",
            "type": "Choice",
            "allowMultiple": false,
            "choices": ["Si", "No"]
          }
        ]
      };
    </script>
  </head>
</html>
"""

SAMPLE_MICROSOFT_RUNTIME_JSON = {
    "id": "runtime-form-123",
    "title": "CUESTIONARIO SOBRE OCIO Y TIEMPO LIBRE",
    "questions": [
        {
            "id": "r5bd0ee570ab347c0af336ee7b2ce0ee6",
            "title": "En los ultimos 3 meses, con que frecuencia has salido?",
            "type": "Question.Choice",
            "choices": [],
            "questionInfo": "{\"Choices\":[{\"Description\":\"Nunca\"},{\"Description\":\"1 a 3 veces\"}],\"ChoiceType\":1}",
        },
        {
            "id": "rff1adf04be3b42f4b9e1e178",
            "title": "Que te ayudaria mas?",
            "type": "Question.Choice",
            "choices": [],
            "questionInfo": "{\"Choices\":[{\"Description\":\"Mas apoyo\"},{\"Description\":\"Mejor transporte\"}],\"ChoiceType\":2}",
        },
    ],
}


def test_extract_microsoft_form_id_from_common_urls():
    assert extract_microsoft_form_id("https://forms.office.com/r/abc123") == "abc123"
    assert extract_microsoft_form_id("https://forms.cloud.microsoft/e/7S9B6Yur2E?origin=lprLink") == "7S9B6Yur2E"
    assert extract_microsoft_form_id("https://forms.office.com/Pages/ResponsePage.aspx?id=form-id-456") == "form-id-456"


def test_import_microsoft_form_from_html_maps_choice_questions():
    form = import_microsoft_form_from_html("ms-form-123", SAMPLE_MICROSOFT_HTML)

    assert form.provider == "microsoft"
    assert form.title == "Revision diaria"
    assert form.submit_url.endswith("/responses")
    assert [question.title for question in form.questions] == ["Como estas?", "Quieres descansar?"]
    assert form.questions[0].type == "checkbox"
    assert form.questions[1].type == "radio"
    assert [option.label for option in form.questions[0].options] == ["Tengo sed", "Tengo frio"]


def test_import_microsoft_form_from_runtime_json_maps_question_info_choices():
    form = import_microsoft_form_from_runtime_json("runtime-form-123", SAMPLE_MICROSOFT_RUNTIME_JSON)

    assert form.title == "CUESTIONARIO SOBRE OCIO Y TIEMPO LIBRE"
    assert form.questions[0].type == "radio"
    assert [option.label for option in form.questions[0].options] == ["Nunca", "1 a 3 veces"]
    assert form.questions[1].type == "checkbox"
    assert [option.label for option in form.questions[1].options] == ["Mas apoyo", "Mejor transporte"]


def test_import_microsoft_form_from_runtime_json_sorts_questions_by_order():
    form = import_microsoft_form_from_runtime_json(
        "runtime-form-123",
        {
            "title": "Orden",
            "questions": [
                {
                    "id": "q-b",
                    "title": "Segunda",
                    "order": 200,
                    "type": "Question.Choice",
                    "questionInfo": "{\"Choices\":[{\"Description\":\"B\"}],\"ChoiceType\":1}",
                },
                {
                    "id": "q-a",
                    "title": "Primera",
                    "order": 100,
                    "type": "Question.Choice",
                    "questionInfo": "{\"Choices\":[{\"Description\":\"A\"}],\"ChoiceType\":1}",
                },
            ],
        },
    )

    assert [question.title for question in form.questions] == ["Primera", "Segunda"]


def test_import_microsoft_form_prefers_runtime_payload_over_ambiguous_html():
    html = """
    <html>
      <body>
        <script>
          window.__MS_FORMS_BOOTSTRAP__ = {
            "title": "HTML ambiguo",
            "questions": [
              {
                "id": "html-q",
                "title": "Pregunta HTML",
                "type": "Question.Choice",
                "questionInfo": "{\\"Choices\\":[{\\"Description\\":\\"HTML\\"}],\\"ChoiceType\\":1}"
              }
            ]
          };
          window.__RUNTIME__ = {
            "prefetchFormUrl": "https://forms.cloud.microsoft/formapi/api/runtimeForms(\\u0027demo\\u0027)?$expand=questions($expand=choices)"
          };
        </script>
      </body>
    </html>
    """
    runtime_json = {
        "title": "Runtime correcto",
        "questions": [
            {
                "id": "runtime-b",
                "title": "Segunda",
                "order": 200,
                "type": "Question.Choice",
                "questionInfo": "{\"Choices\":[{\"Description\":\"B\"}],\"ChoiceType\":1}",
            },
            {
                "id": "runtime-a",
                "title": "Primera",
                "order": 100,
                "type": "Question.Choice",
                "questionInfo": "{\"Choices\":[{\"Description\":\"A\"}],\"ChoiceType\":1}",
            },
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if "runtimeForms('demo')" in str(request.url):
            return httpx.Response(200, json=runtime_json)
        return httpx.Response(200, text=html)

    form = import_microsoft_form(
        "https://forms.cloud.microsoft/e/demo",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert form.title == "Runtime correcto"
    assert [question.title for question in form.questions] == ["Primera", "Segunda"]


def test_submit_microsoft_form_posts_answer_payload():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"ok": True})

    form = import_microsoft_form_from_html("ms-form-123", SAMPLE_MICROSOFT_HTML)
    result = submit_microsoft_form(
        form,
        {"q1": ["Tengo sed"], "q2": ["No"]},
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert result.submitted is True
    body = requests[0].content.decode()
    assert "Tengo sed" in body
    assert "No" in body


def test_submit_microsoft_form_uses_microsoft_response_contract():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(201, json={"id": 1})

    result = submit_microsoft_form_by_entries(
        "https://forms.office.com/formapi/api/demo/responses",
        {"q1": ["Tengo sed"], "q2": ["No"], "q3": ["Opcion A", "Opcion B"]},
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert result.submitted is True
    payload = json.loads(requests[0].content)
    assert isinstance(payload["answers"], str)
    assert json.loads(payload["answers"]) == [
        {"questionId": "q1", "answer1": "Tengo sed"},
        {"questionId": "q2", "answer1": "No"},
        {"questionId": "q3", "answer1": "Opcion A;Opcion B"},
    ]
    assert datetime.fromisoformat(payload["startDate"].replace("Z", "+00:00"))
    assert datetime.fromisoformat(payload["submitDate"].replace("Z", "+00:00"))


def test_submit_microsoft_form_logs_json_rejection_reason_and_safe_metadata(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403,
            json={"error": {"code": "AccessDenied", "message": "Anyone can respond is disabled"}},
            headers={
                "content-type": "application/json",
                "request-id": "request-123",
                "x-ms-correlation-request-id": "correlation-456",
                "set-cookie": "secret-cookie",
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with caplog.at_level(logging.WARNING, logger="app.services.microsoft_forms"):
        result = submit_microsoft_form_by_entries(
            "https://forms.office.com/formapi/api/demo/responses?token=secret-token",
            {"q1": ["private answer"]},
            client=client,
        )

    assert result.submitted is False
    log_text = caplog.text
    assert "status=403" in log_text
    assert "reason='AccessDenied: Anyone can respond is disabled'" in log_text
    assert "url=https://forms.office.com/formapi/api/demo/responses" in log_text
    assert "content_type='application/json'" in log_text
    assert "request_id='request-123'" in log_text
    assert "correlation_id='correlation-456'" in log_text
    assert "secret-token" not in log_text
    assert "private answer" not in log_text
    assert "secret-cookie" not in log_text


def test_submit_microsoft_form_logs_sanitized_truncated_text_rejection(caplog):
    response_body = (
        "<html><body>Request rejected for user@example.com "
        "token=super-secret&sig=hidden-value "
        + ("x" * 1400)
        + "</body></html>"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text=response_body, headers={"content-type": "text/html; charset=utf-8"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with caplog.at_level(logging.WARNING, logger="app.services.microsoft_forms"):
        result = submit_microsoft_form_by_entries(
            "https://forms.office.com/formapi/api/demo/responses",
            {"q1": ["private answer"]},
            client=client,
        )

    assert result.submitted is False
    log_text = caplog.text
    assert "status=400" in log_text
    assert "user@example.com" not in log_text
    assert "super-secret" not in log_text
    assert "hidden-value" not in log_text
    assert "private answer" not in log_text
    assert "[redacted-email]" in log_text
    assert "[redacted]" in log_text
    assert "[truncated]" in log_text


def test_submit_microsoft_form_logs_when_rejection_has_no_reason(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, content=b"", headers={"content-type": "application/json"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with caplog.at_level(logging.WARNING, logger="app.services.microsoft_forms"):
        result = submit_microsoft_form_by_entries(
            "https://forms.office.com/formapi/api/demo/responses",
            {"q1": ["No"]},
            client=client,
        )

    assert result.submitted is False
    assert "status=429" in caplog.text
    assert "reason='Microsoft did not provide a rejection reason'" in caplog.text
    assert "body_preview=''" in caplog.text


def test_submit_microsoft_form_logs_timeout_without_answers(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out while sending private answer", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with caplog.at_level(logging.WARNING, logger="app.services.microsoft_forms"):
        with pytest.raises(httpx.ReadTimeout):
            submit_microsoft_form_by_entries(
                "https://forms.office.com/formapi/api/demo/responses?token=secret-token",
                {"q1": ["private answer"]},
                client=client,
            )

    assert "transport_error=ReadTimeout" in caplog.text
    assert "url=https://forms.office.com/formapi/api/demo/responses" in caplog.text
    assert "secret-token" not in caplog.text
    assert "private answer" not in caplog.text


def test_submit_microsoft_form_success_does_not_log_warning(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with caplog.at_level(logging.WARNING, logger="app.services.microsoft_forms"):
        result = submit_microsoft_form_by_entries(
            "https://forms.office.com/formapi/api/demo/responses",
            {"q1": ["No"]},
            client=client,
        )

    assert result.submitted is True
    assert not caplog.records
