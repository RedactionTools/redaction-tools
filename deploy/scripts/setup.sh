#!/usr/bin/env bash
# One-time bootstrap for a deploy server: trigger keypair, GitHub secret,
# server branch, and an initial clone on the VM. Requires local `ssh-copy-id`,
# `gh` (authenticated), and SSH access to the VM as DEPLOY_USER.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

server="${1:?usage: setup.sh <server>}"
require_server "$server"

mkdir -p "$DEPLOY_ROOT/keys"

if [[ ! -f "$KEY_FILE" ]]; then
	echo "==> Generating trigger keypair at $KEY_FILE"
	ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "deploy-trigger-${server}"
else
	echo "==> Trigger keypair already exists at $KEY_FILE, reusing"
fi

echo "==> Installing the public key on ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT}"
ssh-copy-id -i "${KEY_FILE}.pub" -p "$DEPLOY_PORT" "${DEPLOY_USER}@${DEPLOY_HOST}"

echo "==> Registering GitHub secret DEPLOY_$(echo "$server" | tr '[:lower:]' '[:upper:]')_SSH_KEY"
gh secret set "DEPLOY_$(echo "$server" | tr '[:lower:]' '[:upper:]')_SSH_KEY" <"$KEY_FILE"

if ! git show-ref --verify --quiet "refs/heads/${server}"; then
	echo "==> Creating local branch '${server}' from main"
	git branch "$server" main
fi
echo "==> Pushing branch '${server}' to origin"
git push origin "$server"

echo "==> Cloning the repo into ${DEPLOY_DIR} on the VM (public repo, plain HTTPS)"
repo_url="$(git config --get remote.origin.url)"
remote_ssh "test -d '${DEPLOY_DIR}/.git' || git clone --branch '${server}' '${repo_url}' '${DEPLOY_DIR}'"

env_file="$DEPLOY_ROOT/../.env.${server}"
if [[ ! -f "$env_file" ]]; then
	echo "==> Seeding ${env_file} from .env.example"
	cp "$DEPLOY_ROOT/../.env.example" "$env_file"
	echo "    Fill in real SECRET_KEY, AUTH_SECRET, POSTGRES_PASSWORD, OAuth"
	echo "    credentials, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, and the real"
	echo "    public NEXT_PUBLIC_API_URL before running: make deploy-env-put SERVER=${server}"
else
	echo "==> ${env_file} already exists, leaving it as-is"
fi

echo "==> Done. Next steps:"
echo "    1. Edit ${env_file} with real production values"
echo "    2. make deploy-env-put SERVER=${server}"
echo "    3. git push origin ${server} (or make deploy SERVER=${server}) to trigger a deploy"
