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

USER app

EXPOSE 8007

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8007", "--workers", "3", "--access-logfile", "-"]
