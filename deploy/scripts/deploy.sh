#!/usr/bin/env bash
# Re-trigger the deploy workflow for a server without needing a new commit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

server="${1:?usage: deploy.sh <server>}"
require_server "$server"

gh workflow run deploy.yml -f "server=${server}"
echo "==> Triggered. Watch with: gh run watch"
