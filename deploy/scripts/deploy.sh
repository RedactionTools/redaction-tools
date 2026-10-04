#!/usr/bin/env bash
# Deploy the tip of main to a server now, without waiting for a merge.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

server="${1:?usage: deploy.sh <server>}"
require_server "$server"

gh workflow run deploy.yml -f "server=${server}"
echo "==> Triggered. Watch with: gh run watch"
