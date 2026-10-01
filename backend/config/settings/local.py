"""Developer machine settings: `DJANGO_SETTINGS_MODULE=config.settings.local`."""

from config.mail import SMTP_BACKEND, default_mailer

from .base import *  # noqa: F403
from .base import Q_CLUSTER as BASE_Q_CLUSTER
from .base import env

DEBUG = env.bool("DEBUG", default=True)

SECRET_KEY = env("SECRET_KEY", default="django-insecure-local-only-do-not-use-in-production")

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "backend"]  # noqa: S104

# Serve /_allauth/openapi.html so the frontend can browse the auth API.
HEADLESS_SERVE_SPECIFICATION = True

# Any localhost port may call the API while the frontend is under development.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://localhost:\d+$", r"^http://127\.0\.0\.1:\d+$"]

# Set Q_SYNC=true to run tasks in-process instead of starting a qcluster.
Q_CLUSTER = {**BASE_Q_CLUSTER, "sync": env.bool("Q_SYNC", default=False)}

# Mail goes to Mailpit (`make up` starts it; inbox at http://localhost:8025).
# EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend prints it instead.
MAILERS = {
    "default": default_mailer(
        env, default_backend=SMTP_BACKEND, smtp_port=1025, smtp_use_tls=False
    ),
}
