#!/usr/bin/env bash
# Tail a server's remote container logs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

server="${1:?usage: logs.sh <server> [--follow] [--tail N]}"
shift
require_server "$server"

follow=""
tail="200"
while [[ $# -gt 0 ]]; do
	case "$1" in
	--follow)
		follow="-f"
		shift
		;;
	--tail)
		tail="$2"
		shift 2
		;;
	*)
		echo "error: unknown option '$1'" >&2
		exit 1
		;;
	esac
done

remote_ssh -t "cd '${DEPLOY_DIR}' && docker compose -f '${DEPLOY_COMPOSE_FILE}' logs ${follow} --tail ${tail}"
