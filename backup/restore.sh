#!/bin/bash
# Loads a backup.sh dump into a database. Stop backend and qcluster first, or
# they hold connections and write mid-restore.
set -eo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

if [ -z "$1" ]; then
    cat <<USAGE
Usage: $0 <backup> [target-database]

  <backup> is s3://<bucket>/<folder>/<file>, a bare file name (looked up in
  S3_BUCKET/S3_FOLDER), or a path to a file inside the container.
  [target-database] defaults to POSTGRES_DB; it is created if missing.

List what is available with:  mc ls backup/\${S3_BUCKET}/\${S3_FOLDER}/
USAGE
    exit 1
fi

SOURCE="$1"
TARGET_DATABASE="${2:-${POSTGRES_DB}}"

for var in POSTGRES_HOST POSTGRES_PORT POSTGRES_USER POSTGRES_PASSWORD; do
    if [ -z "${!var}" ]; then
        error_exit "Required environment variable ${var} is not set"
    fi
done

if [[ "${SOURCE}" == s3://* ]]; then
    MC_SOURCE="backup/${SOURCE#s3://}"
elif [ ! -f "${SOURCE}" ] && [[ "${SOURCE}" != */* ]]; then
    MC_SOURCE="backup/${S3_BUCKET}/${S3_FOLDER}/${SOURCE}"
fi

if [ -n "${MC_SOURCE}" ]; then
    SOURCE_FILE="/tmp/backups/$(basename "${MC_SOURCE}")"
    trap 'rm -f "${SOURCE_FILE}"' EXIT
    log "Downloading ${MC_SOURCE}..."
    mc cp --quiet "${MC_SOURCE}" "${SOURCE_FILE}" > /dev/null \
        || error_exit "Failed to download backup from S3"
else
    SOURCE_FILE="${SOURCE}"
fi
[ -f "${SOURCE_FILE}" ] || error_exit "Source file not found: ${SOURCE_FILE}"

case "${SOURCE_FILE}" in
    *.gz) DECOMPRESS="pigz -d -c" ;;
    *.zst) DECOMPRESS="zstd -d -c" ;;
    *) DECOMPRESS="cat" ;;
esac

export PGPASSWORD="${POSTGRES_PASSWORD}"
PG_ARGS=(-h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}")

attempt=0
until psql "${PG_ARGS[@]}" -d postgres -c "SELECT 1" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ $attempt -ge 30 ] && error_exit "PostgreSQL is not ready after 30 attempts"
    log "Waiting for PostgreSQL... (attempt ${attempt}/30)"
    sleep 2
done

DB_EXISTS=$(psql "${PG_ARGS[@]}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${TARGET_DATABASE}'")
if [ "${DB_EXISTS}" != "1" ]; then
    log "Creating database '${TARGET_DATABASE}'..."
    psql "${PG_ARGS[@]}" -d postgres -c "CREATE DATABASE \"${TARGET_DATABASE}\";" \
        || error_exit "Failed to create database"
fi

log "Dropping existing connections to '${TARGET_DATABASE}'..."
psql "${PG_ARGS[@]}" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TARGET_DATABASE}' AND pid <> pg_backend_pid();" \
    > /dev/null || log "WARNING: Failed to drop existing connections"

# One transaction with ON_ERROR_STOP: a restore that fails partway leaves the
# database as it was rather than half-replaced.
log "Restoring ${SOURCE_FILE} into '${TARGET_DATABASE}'..."
${DECOMPRESS} "${SOURCE_FILE}" \
    | psql "${PG_ARGS[@]}" -d "${TARGET_DATABASE}" --quiet -v ON_ERROR_STOP=1 --single-transaction \
        > /dev/null \
    || error_exit "Database restore failed"

TABLE_COUNT=$(psql "${PG_ARGS[@]}" -d "${TARGET_DATABASE}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
log "Restore completed: '${TARGET_DATABASE}' has ${TABLE_COUNT} tables"
