"""Settings shared by every environment.

Values that differ per environment come from the environment itself (12-factor);
see `.env.example` for the full list. Environment-specific overrides live in
`local.py`, `production.py` and `test.py`.
"""

from datetime import timedelta
from pathlib import Path

import environ

# backend/
BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3007"]),
    FRONTEND_URL=(str, "http://localhost:3007"),
    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
    JWT_ACCESS_TOKEN_LIFETIME=(int, 15 * 60),
    JWT_REFRESH_TOKEN_LIFETIME=(int, 14 * 24 * 60 * 60),
)

environ.Env.read_env(BASE_DIR / ".env")

# No usable default on purpose: local.py and test.py supply their own key, and
# production.py re-reads it without a default so a missing key fails at boot.
SECRET_KEY = env("SECRET_KEY", default="")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# The Next.js frontend; used for CORS and for the links allauth puts in emails.
FRONTEND_URL = env("FRONTEND_URL").rstrip("/")

INSTALLED_APPS = [
    # Unfold has to precede django.contrib.admin to override its templates.
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Third party
    "corsheaders",
    "ninja",  # for the export_openapi_schema management command (Orval input)
    "django_q",
    "ninja_apikey",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.headless",
    "django_mcpz",
    "django_mcpz.oauth",
    "django_mcpz.bearer_tokens",
    # Local
    "apps.core",
    "apps.accounts",
    "apps.catalog",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)

SITE_ID = 1

# Authentication
AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# The OAuth consent page sends anonymous users here, so it is load-bearing for
# the MCP connector flow rather than incidental. Django's default happens to be
# right - it is allauth's login page, which SOCIALACCOUNT_ONLY makes Google-only.
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/admin/"

# allauth: email is the identifier, Google is the only provider for now.
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "none"  # Google hands us verified addresses
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_PREVENT_ENUMERATION = True
SOCIALACCOUNT_ONLY = True  # flip off when magic link / password login lands
SOCIALACCOUNT_STORE_TOKENS = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapters.SocialAccountAdapter"

# Credentials live in the environment rather than in SocialApp rows, so secrets
# never end up in the database. Do not also create a SocialApp in the admin.
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APPS": [
            {
                "client_id": env("GOOGLE_CLIENT_ID"),
                "secret": env("GOOGLE_CLIENT_SECRET"),
                "key": "",
            },
        ],
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "OAUTH_PKCE_ENABLED": True,
        "VERIFIED_EMAIL": True,
    },
}

# allauth.headless: the API the Next.js frontend talks to. Its auth responses
# carry our own JWT thanks to the token strategy below.
HEADLESS_ONLY = False  # keep the server-rendered /accounts/ views for local debugging
HEADLESS_CLIENTS = ("app", "browser")
HEADLESS_TOKEN_STRATEGY = "apps.accounts.tokens.JWTTokenStrategy"
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/auth/verify-email/{{key}}",
    "account_reset_password": f"{FRONTEND_URL}/auth/password/reset",
    "account_reset_password_from_key": f"{FRONTEND_URL}/auth/password/reset/key/{{key}}",
    "account_signup": f"{FRONTEND_URL}/auth/signup",
    "socialaccount_login_error": f"{FRONTEND_URL}/auth/provider/callback",
}

# JWT issued to the frontend (see apps/accounts/jwt.py). Empty means "sign with
# SECRET_KEY"; set JWT_SIGNING_KEY to rotate tokens independently of Django sessions.
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default="")
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "redaction-tools"
JWT_ACCESS_TOKEN_LIFETIME = timedelta(seconds=env("JWT_ACCESS_TOKEN_LIFETIME"))
JWT_REFRESH_TOKEN_LIFETIME = timedelta(seconds=env("JWT_REFRESH_TOKEN_LIFETIME"))

# The frontend is a separate origin, so it needs CORS to reach /api/ and /_allauth/.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# Background tasks (django-q2). The ORM broker keeps local setup to Postgres only.
Q_CLUSTER = {
    "name": "redaction-tools",
    "workers": env.int("Q_WORKERS", default=2),
    "recycle": 500,
    "timeout": 600,
    "retry": 900,
    "queue_limit": 50,
    "bulk": 10,
    "orm": "default",
    "catch_up": False,
    "max_attempts": 3,
}

# Admin
UNFOLD = {
    "SITE_TITLE": "redaction-tools",
    "SITE_HEADER": "redaction-tools",
    "SITE_SUBHEADER": "Catalog of redaction tools",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "COLORS": {
        "primary": {
            "50": "240 249 255",
            "100": "224 242 254",
            "200": "186 230 253",
            "300": "125 211 252",
            "400": "56 189 248",
            "500": "14 165 233",
            "600": "2 132 199",
            "700": "3 105 161",
            "800": "7 89 133",
            "900": "12 74 110",
            "950": "8 47 73",
        },
    },
}

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static / media
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Throttling reads the default cache. LocMem is per process, so with several
# gunicorn workers the effective limit is rate x workers - acceptable for a soft
# anti-abuse control, and the reason this is an env var rather than a literal.
CACHES = {
    "default": {
        "BACKEND": env("CACHE_BACKEND", default="django.core.cache.backends.locmem.LocMemCache"),
        "LOCATION": env("CACHE_LOCATION", default="redaction-tools"),
    }
}

MAILERS = {
    "default": {
        "BACKEND": env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"),
    },
}
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@redaction-tools.com")

# --- Catalog ---------------------------------------------------------------
# Hosts the SSRF guard refuses outright, on top of the private-range check. The
# defaults are this stack's own compose service names, so a dev environment
# fails closed rather than discovering the hole in production.
CATALOG_BLOCKED_HOSTS = env.list(
    "CATALOG_BLOCKED_HOSTS", default=["localhost", "backend", "db", "qcluster", "frontend"]
)

# Per-account limits on the write endpoints. Login is the primary anti-abuse
# control; these stop one account flooding a review queue.
CATALOG_READ_RATE = env("CATALOG_READ_RATE", default="120/min")
CATALOG_SUBMIT_RATE = env("CATALOG_SUBMIT_RATE", default="5/hour")
CATALOG_CLAIM_RATE = env("CATALOG_CLAIM_RATE", default="10/day")
CATALOG_MAX_OPEN_SUBMISSIONS = env.int("CATALOG_MAX_OPEN_SUBMISSIONS", default=5)

# --- Staff MCP server ------------------------------------------------------
# The MCP endpoint is /mcp; its OAuth authorization server is /oauth/. Claude's
# connectors register themselves rather than being configured by hand.
# Registration alone grants nothing: authorising still needs a staff sign-in and
# consent, and a non-staff token is refused at the door by
# `apps.accounts.mcp_auth.staff_auth`. Turn it off and every client has to be
# created in the admin first.
MCPZ_OAUTH_DYNAMIC_REGISTRATION = env.bool("MCP_OAUTH_DYNAMIC_REGISTRATION", default=True)
MCPZ_OAUTH_ACCESS_TOKEN_LIFETIME = timedelta(
    seconds=env.int("MCP_ACCESS_TOKEN_LIFETIME", default=60 * 60)
)
MCPZ_OAUTH_REFRESH_TOKEN_LIFETIME = timedelta(
    seconds=env.int("MCP_REFRESH_TOKEN_LIFETIME", default=30 * 24 * 60 * 60)
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {
        "django.db.backends": {"level": "INFO", "handlers": ["console"], "propagate": False},
        # Every MCP tool call: which tool, its arguments, the outcome and how
        # long it took. The audit trail for a surface that writes live prices.
        "django_mcpz.calls": {"level": "INFO", "handlers": ["console"], "propagate": False},
    },
}
