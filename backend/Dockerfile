FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

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


FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

COPY --from=builder --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app . .

USER app

EXPOSE 8007

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8007", "--workers", "3", "--access-logfile", "-"]
