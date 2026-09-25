"""Test settings: used by pytest (see [tool.pytest.ini_options] in pyproject.toml)."""

from .base import *  # noqa: F403
from .base import MIDDLEWARE as BASE_MIDDLEWARE
from .base import Q_CLUSTER as BASE_Q_CLUSTER
from .base import SOCIALACCOUNT_PROVIDERS as BASE_SOCIALACCOUNT_PROVIDERS

DEBUG = False

SECRET_KEY = "django-insecure-test-key-that-is-long-enough-for-hs256"

ALLOWED_HOSTS = ["testserver", "localhost"]

# Nothing is collected into staticfiles/ during tests.
MIDDLEWARE = [m for m in BASE_MIDDLEWARE if "whitenoise" not in m]

# Hashing dominates the runtime of auth tests otherwise.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}

# Tasks run inline so tests never need a qcluster process.
Q_CLUSTER = {**BASE_Q_CLUSTER, "sync": True}

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

GOOGLE_CLIENT_ID = "test-client-id"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        **BASE_SOCIALACCOUNT_PROVIDERS["google"],
        "APPS": [{"client_id": GOOGLE_CLIENT_ID, "secret": "test-secret", "key": ""}],
    },
}

# The OCR layer is ~25 s per scored page; the parity test in test_benchmarks_scorer.py
# still runs it, by calling pdfredeval directly.
BENCHMARK_OCR = False
