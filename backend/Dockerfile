# Alpine, so the runtime image carries musl + BusyBox rather than a Debian
# userland. Nothing here is compiled: psycopg-binary and cryptography both
# publish musllinux_1_2 wheels for cp313 on x86_64 and aarch64, which is what
# CI and an Apple-silicon machine build for. If a future `uv lock` bump lands a
# dependency with no musl wheel, `uv sync` will say so, and the fix is
# `apk add --no-cache gcc musl-dev postgresql-dev` in the builder only.
FROM ghcr.io/astral-sh/uv:python3.13-alpine AS builder

# The virtualenv lives outside /app so a bind-mounted source tree (docker compose
# in development) cannot shadow it.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

# Dependencies are their own layer so code changes do not re-resolve them.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev


FROM python:3.13-alpine AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# BusyBox adduser/addgroup, not the shadow-utils spelling: -S makes a system
# account, -G sets the group, -H skips the home directory we do not use.
RUN addgroup -S app && adduser -S -G app -H -h /app app

WORKDIR /app

# --chown on the COPY itself. A later `RUN chown -R` would make overlayfs
# copy up the whole tree into a second layer, roughly doubling the image.
COPY --from=builder --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app . .

# WORKDIR created /app as root, so the app user cannot write anything directly
# inside it - that breaks collectstatic's STATIC_ROOT and gunicorn's control
# socket at /app/.gunicorn. Non-recursive on purpose: this touches one inode,
# where `chown -R` would make overlayfs copy up the whole tree into a second
# layer and roughly double the image.
RUN chown app:app /app

USER app

# Collected at build time: production uses whitenoise's manifest storage, which
# raises on a missing manifest entry, so without this the admin 500s on its own
# CSS. No database is touched - the placeholders only satisfy settings that are
# required at import. Runs after USER so the files come out app-owned.
RUN SECRET_KEY=build-time-placeholder \
    ALLOWED_HOSTS=localhost \
    CSRF_TRUSTED_ORIGINS=https://localhost \
    CORS_ALLOWED_ORIGINS=https://localhost \
    FRONTEND_URL=https://localhost \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    python manage.py collectstatic --noinput

EXPOSE 8007

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8007", "--workers", "3", "--access-logfile", "-"]
