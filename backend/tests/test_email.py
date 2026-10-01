"""Templated transactional email: subject, text and HTML rendered from `email/<name>/`."""

from django.core import mail

from apps.core.email import send_templated_email

CONTEXT = {"tool_name": "AT&T Redact", "code": "042917", "email": "rep@att.com", "ttl_minutes": 30}


def _send():
    send_templated_email("claim_code", CONTEXT, to=["rep@att.com"])
    [message] = mail.outbox
    return message


def test_sends_text_with_an_html_alternative():
    message = _send()

    assert message.to == ["rep@att.com"]
    assert "042917" in message.body
    [(html, mimetype)] = message.alternatives
    assert mimetype == "text/html"
    assert "042917" in html


def test_the_subject_is_one_line_and_not_html_escaped():
    message = _send()

    assert message.subject == "Your code to claim AT&T Redact"


def test_only_the_html_part_is_escaped():
    """The text part is read as text: `&amp;` there is a bug the reader sees."""
    message = _send()
    [(html, _)] = message.alternatives

    assert "AT&T Redact" in message.body
    assert "AT&amp;T Redact" in html
    assert "AT&T Redact" not in html


def test_the_html_part_carries_the_shared_layout(settings):
    settings.FRONTEND_URL = "https://redaction-tools.com"
    message = _send()
    [(html, _)] = message.alternatives

    assert html.lstrip().lower().startswith("<!doctype html>")
    assert 'href="https://redaction-tools.com"' in html


def test_the_header_carries_the_logo_from_the_site(settings):
    """Absolute, because a mail client has no page to resolve a relative URL against."""
    settings.FRONTEND_URL = "https://redaction-tools.com"
    [(html, _)] = _send().alternatives

    assert 'src="https://redaction-tools.com/images/email/logo.png"' in html
    # Decorative: the wordmark beside it already names the site, and a client that
    # blocks images would otherwise show the name twice.
    assert 'alt=""' in html


def test_sends_from_the_default_sender(settings):
    settings.DEFAULT_FROM_EMAIL = "Redaction Tools <noreply@redaction-tools.com>"

    assert _send().from_email == "Redaction Tools <noreply@redaction-tools.com>"
