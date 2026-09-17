#!/usr/bin/env bash
# Recreate a server's containers without rebuilding images. Picks up new
# .env values, but NOT a changed NEXT_PUBLIC_API_URL (that's baked at build
# time - use deploy.sh for that).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

server="${1:?usage: restart.sh <server>}"
require_server "$server"

remote_ssh "cd '${DEPLOY_DIR}' && docker compose -f '${DEPLOY_COMPOSE_FILE}' up -d --force-recreate"
