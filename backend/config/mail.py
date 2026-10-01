"""Which backend sends transactional email.

Brevo's HTTP API when `BREVO_API_KEY` is set (via django-anymail). Otherwise
`EMAIL_BACKEND`, defaulting per environment: the console in base settings, Mailpit
over SMTP in development, the SMTP relay in production. Kept out of the settings
modules so the choice is testable.
"""

BREVO_BACKEND = "anymail.backends.brevo.EmailBackend"
SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"


def default_mailer(
    env, *, default_backend: str, smtp_port: int = 587, smtp_use_tls: bool = True
) -> dict:
    """The `MAILERS["default"]` entry for this environment."""
    if api_key := env("BREVO_API_KEY", default=""):
        return {"BACKEND": BREVO_BACKEND, "OPTIONS": {"api_key": api_key}}

    backend = env("EMAIL_BACKEND", default=default_backend)
    if backend != SMTP_BACKEND:
        # Django rejects OPTIONS a backend does not accept; the console takes none.
        return {"BACKEND": backend}

    return {
        "BACKEND": backend,
        "OPTIONS": {
            "host": env("EMAIL_HOST", default="localhost"),
            "port": env.int("EMAIL_PORT", default=smtp_port),
            "username": env("EMAIL_HOST_USER", default=""),
            "password": env("EMAIL_HOST_PASSWORD", default=""),
            "use_tls": env.bool("EMAIL_USE_TLS", default=smtp_use_tls),
            "timeout": env.int("EMAIL_TIMEOUT", default=10),
        },
    }
