#!/usr/bin/env bash
# Shared helpers for deploy/scripts/*.sh. Source this, don't run it directly.
set -euo pipefail

DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_server() {
	local server="$1"
	local conf="$DEPLOY_ROOT/servers/${server}.conf"
	if [[ ! -f "$conf" ]]; then
		echo "error: no such server config: $conf" >&2
		exit 1
	fi
	# shellcheck disable=SC1090
	source "$conf"
	: "${DEPLOY_PORT:=22}"
	for var in DEPLOY_HOST DEPLOY_USER DEPLOY_DIR DEPLOY_COMPOSE_FILE; do
		if [[ -z "${!var:-}" ]]; then
			echo "error: $var is not set in $conf" >&2
			exit 1
		fi
	done
	KEY_FILE="$DEPLOY_ROOT/keys/${server}_deploy"
}

remote_ssh() {
	local tty_flag=()
	if [[ "${1:-}" == "-t" ]]; then
		tty_flag=("-t")
		shift
	fi
	ssh -i "$KEY_FILE" -p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new \
		"${tty_flag[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}
