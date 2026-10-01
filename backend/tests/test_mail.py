"""Which backend sends mail: Brevo with a key, otherwise EMAIL_BACKEND and its SMTP options."""

import environ
import pytest
import requests
from django.core.mail import send_mail

from config.mail import default_mailer

BREVO_BACKEND = "anymail.backends.brevo.EmailBackend"
SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
CONSOLE_BACKEND = "django.core.mail.backends.console.EmailBackend"

MAIL_VARS = (
    "BREVO_API_KEY",
    "EMAIL_BACKEND",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_HOST_USER",
    "EMAIL_HOST_PASSWORD",
    "EMAIL_USE_TLS",
    "EMAIL_TIMEOUT",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in MAIL_VARS:
        monkeypatch.delenv(name, raising=False)


def _mailer(**defaults):
    return default_mailer(environ.Env(), **defaults)


def test_a_brevo_key_selects_brevo(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")

    assert _mailer(default_backend=SMTP_BACKEND) == {
        "BACKEND": BREVO_BACKEND,
        "OPTIONS": {"api_key": "xkeysib-test"},
    }


def test_a_non_smtp_backend_takes_no_options():
    """Django rejects OPTIONS a backend does not accept, and the console accepts none."""
    assert _mailer(default_backend=CONSOLE_BACKEND) == {"BACKEND": CONSOLE_BACKEND}


def test_smtp_reads_its_options_from_the_environment(monkeypatch):
    monkeypatch.setenv("EMAIL_HOST", "smtp.example.com")
    monkeypatch.setenv("EMAIL_HOST_USER", "user")
    monkeypatch.setenv("EMAIL_HOST_PASSWORD", "secret")

    assert _mailer(default_backend=SMTP_BACKEND) == {
        "BACKEND": SMTP_BACKEND,
        "OPTIONS": {
            "host": "smtp.example.com",
            "port": 587,
            "username": "user",
            "password": "secret",
            "use_tls": True,
            "timeout": 10,
        },
    }


def test_smtp_defaults_are_per_environment():
    """Development points at Mailpit: its own port, and no STARTTLS to negotiate."""
    options = _mailer(default_backend=SMTP_BACKEND, smtp_port=1025, smtp_use_tls=False)["OPTIONS"]

    assert (options["host"], options["port"], options["use_tls"]) == ("localhost", 1025, False)


def test_email_backend_overrides_the_default(monkeypatch):
    monkeypatch.setenv("EMAIL_BACKEND", CONSOLE_BACKEND)

    assert _mailer(default_backend=SMTP_BACKEND) == {"BACKEND": CONSOLE_BACKEND}


def test_mail_goes_out_through_the_brevo_api(settings, monkeypatch):
    """The wiring end to end: Django's send_mail reaches Brevo's HTTP API with the key."""
    settings.MAILERS = {
        "default": {"BACKEND": BREVO_BACKEND, "OPTIONS": {"api_key": "xkeysib-test"}}
    }
    sent = []

    def fake_request(_session, method, url, **kwargs):
        sent.append((method, url, kwargs))
        response = requests.Response()
        response.status_code = 201
        response._content = b'{"messageId": "<1@smtp-relay.mailin.fr>"}'
        return response

    monkeypatch.setattr("requests.Session.request", fake_request)

    send_mail("Hello", "Body", "noreply@redaction-tools.com", ["owner@example.com"])

    [(method, url, kwargs)] = sent
    assert (method, url) == ("POST", "https://api.brevo.com/v3/smtp/email")
    assert kwargs["headers"]["api-key"] == "xkeysib-test"
