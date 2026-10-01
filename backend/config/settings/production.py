"""Production settings: `DJANGO_SETTINGS_MODULE=config.settings.production`."""

from config.mail import SMTP_BACKEND, default_mailer

from .base import *  # noqa: F403
from .base import env

DEBUG = False

# Every value below is required in production; a missing one fails loudly at boot.
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

# Transactional email: Brevo's HTTP API when BREVO_API_KEY is set, else the SMTP
# relay in EMAIL_HOST & co. (listmonk / provider). The console backend that base.py
# falls back to is rejected by `manage.py check --deploy`.
MAILERS = {"default": default_mailer(env, default_backend=SMTP_BACKEND)}
