"""Every email in templates/email/ is complete, renders from its sample data, and previews.

The sample data (`preview.json`) is what `make backend-email` sends to Mailpit, so it
doubles as the email's contract: rendering with it must leave no variable unfilled.
"""

import json

import pytest
from django.core import mail
from django.core.management import CommandError, call_command

from apps.core.email import EMAIL_TEMPLATE_DIR, email_names, send_templated_email

FILES = ("subject.txt", "body.txt", "body.mjml", "body.html", "preview.json")
MISSING = "MISSING-VARIABLE"


@pytest.fixture
def strict_templates(settings):
    """Render an unknown variable as a marker instead of Django's silent empty string."""
    [engine] = settings.TEMPLATES
    settings.TEMPLATES = [
        {**engine, "OPTIONS": {**engine.get("OPTIONS", {}), "string_if_invalid": MISSING}}
    ]


def test_there_are_emails_to_check():
    assert "claim_code" in email_names()


def test_partials_are_not_emails():
    assert not [name for name in email_names() if name.startswith("_")]


@pytest.mark.parametrize("name", email_names())
def test_every_email_has_all_its_parts(name):
    folder = EMAIL_TEMPLATE_DIR / name

    assert [file for file in FILES if not (folder / file).is_file()] == []


@pytest.mark.parametrize("name", email_names())
def test_every_email_renders_from_its_sample_data(name, strict_templates):
    context = json.loads((EMAIL_TEMPLATE_DIR / name / "preview.json").read_text())

    send_templated_email(name, context, to=["dev@example.com"])

    [message] = mail.outbox
    [(html, _)] = message.alternatives
    for part in (message.subject, message.body, html):
        assert MISSING not in part


def test_the_preview_command_sends_one_email_with_its_sample_data():
    call_command("send_preview_email", "claim_code", "--to", "me@example.com")

    [message] = mail.outbox
    assert message.to == ["me@example.com"]
    assert message.subject == "Your code to claim Adobe Acrobat"


def test_the_preview_command_can_send_them_all():
    call_command("send_preview_email", "--all")

    assert len(mail.outbox) == len(email_names())


def test_the_preview_command_names_what_exists_when_asked_for_what_does_not():
    with pytest.raises(CommandError, match="claim_code"):
        call_command("send_preview_email", "no_such_email")
