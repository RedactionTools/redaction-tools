# Bun resolves and installs; Node runs Next. The `next` binary's shebang is
# `#!/usr/bin/env node` and the oven/bun images ship no Node, so the bun binary
# is copied into a Node image rather than the other way round. This matches how
# `bun run dev` behaves on a developer machine.
FROM oven/bun:1.3.13-alpine AS bun

FROM node:24-alpine AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app


# Dependencies are their own layer so code changes do not re-resolve them.
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile


FROM base AS builder
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so the API
# origin has to be known here rather than at container start.
ARG NEXT_PUBLIC_API_URL=http://localhost:8007
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build


FROM node:24-alpine AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3007 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

WORKDIR /app

# `output: 'standalone'` emits a self-contained server plus a pruned
# node_modules; static assets and public/ are copied alongside it.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app

EXPOSE 3007

CMD ["node", "server.js"]
