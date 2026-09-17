#!/usr/bin/env bash
# Sync the local per-server .env file with the VM's $DEPLOY_DIR/.env.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

action="${1:?usage: env.sh put|get <server>}"
server="${2:?usage: env.sh put|get <server>}"
require_server "$server"

local_env="$DEPLOY_ROOT/../.env.${server}"

case "$action" in
put)
	if [[ ! -f "$local_env" ]]; then
		echo "error: $local_env does not exist" >&2
		exit 1
	fi
	scp -i "$KEY_FILE" -P "$DEPLOY_PORT" "$local_env" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/.env"
	;;
get)
	if [[ -f "$local_env" ]]; then
		cp "$local_env" "${local_env}.bak"
		echo "==> Backed up existing $local_env to ${local_env}.bak"
	fi
	scp -i "$KEY_FILE" -P "$DEPLOY_PORT" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/.env" "$local_env"
	;;
*)
	echo "error: unknown action '$action', expected put or get" >&2
	exit 1
	;;
esac
