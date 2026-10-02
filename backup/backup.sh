#!/bin/bash
# Dumps the database, compresses it and uploads it to S3, then prunes uploads
# older than BACKUP_KEEP_DAYS. Run by cron (see entrypoint.sh), or by hand:
#   docker compose -f docker-compose-prod.yml exec db-backup /app/backup.sh
set -eo pipefail  # pipefail: without it a failed pg_dump uploads an empty file

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

required_vars=("POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_DB" "POSTGRES_USER"
               "POSTGRES_PASSWORD" "S3_BUCKET" "S3_FOLDER" "AWS_ACCESS_KEY_ID"
               "AWS_SECRET_ACCESS_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        error_exit "Required environment variable ${var} is not set"
    fi
done

case "${COMPRESSION:-pigz}" in
    pigz) COMPRESS="pigz -p 4"; EXTENSION="sql.gz" ;;
    gzip) COMPRESS="gzip"; EXTENSION="sql.gz" ;;
    zstd) COMPRESS="zstd -3"; EXTENSION="sql.zst" ;;
    *)
        log "WARNING: Unknown compression '${COMPRESSION}', defaulting to pigz"
        COMPRESS="pigz -p 4"; EXTENSION="sql.gz"
        ;;
esac

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ "${BACKUP_INCLUDE_HOSTNAME:-false}" = "true" ]; then
    BACKUP_FILENAME="backup_$(hostname)_${TIMESTAMP}.${EXTENSION}"
else
    BACKUP_FILENAME="backup_${TIMESTAMP}.${EXTENSION}"
fi
LOCAL_BACKUP_PATH="/tmp/backups/${BACKUP_FILENAME}"
# "backup" is the mc alias entrypoint.sh points at S3_ENDPOINT.
S3_DIR="backup/${S3_BUCKET}/${S3_FOLDER}"
trap 'rm -f "${LOCAL_BACKUP_PATH}"' EXIT

log "Starting backup of ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT} -> ${S3_DIR}/${BACKUP_FILENAME}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
PG_ARGS=(-h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}")

attempt=0
until psql "${PG_ARGS[@]}" -c "SELECT 1" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ $attempt -ge 30 ] && error_exit "PostgreSQL is not ready after 30 attempts"
    log "Waiting for PostgreSQL... (attempt ${attempt}/30)"
    sleep 2
done

# --clean --if-exists makes the dump drop each object before recreating it, so
# restore.sh can load it over an existing database instead of failing on every
# CREATE. --no-owner --no-acl keep it loadable under a differently named role.
pg_dump "${PG_ARGS[@]}" --clean --if-exists --no-owner --no-acl \
    | ${COMPRESS} > "${LOCAL_BACKUP_PATH}" || error_exit "Backup creation failed"
log "Dump created ($(du -h "${LOCAL_BACKUP_PATH}" | cut -f1))"

mc cp --quiet "${LOCAL_BACKUP_PATH}" "${S3_DIR}/${BACKUP_FILENAME}" > /dev/null \
    || error_exit "S3 upload failed"
log "Uploaded"

if [ -n "${BACKUP_KEEP_DAYS}" ]; then
    mc rm --recursive --force --older-than "${BACKUP_KEEP_DAYS}d" "${S3_DIR}/" \
        || log "WARNING: Old backup cleanup failed"
    log "Pruned backups older than ${BACKUP_KEEP_DAYS} days"
fi

log "Backup completed"
