#!/bin/bash
set -e

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

required_vars=("POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_DB" "POSTGRES_USER"
               "POSTGRES_PASSWORD" "S3_BUCKET" "S3_FOLDER" "AWS_ACCESS_KEY_ID"
               "AWS_SECRET_ACCESS_KEY" "SCHEDULE")
missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done
if [ ${#missing_vars[@]} -gt 0 ]; then
    error_exit "Required environment variables are not set: ${missing_vars[*]}"
fi

# The "backup" alias backup.sh and restore.sh address S3 through. mc keeps it
# in root's home, which cron jobs and `docker compose exec` both read.
S3_URL="${S3_ENDPOINT:-https://s3.amazonaws.com}"
log "Configuring mc alias 'backup' -> ${S3_URL}"
mc alias set backup "${S3_URL}" "${AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY}" --api S3v4 > /dev/null \
    || error_exit "Failed to configure mc alias"

# A command means a one-off run rather than the cron service - the deploy's
# pre-migration backup is `docker compose run --rm db-backup /app/backup.sh`.
if [ $# -gt 0 ]; then
    exec "$@"
fi

# cron starts its jobs with an empty environment, so hand them the container's.
# %q-quoted so a password with shell metacharacters survives the round trip.
: > /app/backup.env
chmod 600 /app/backup.env
for var in "${required_vars[@]}" S3_ENDPOINT COMPRESSION BACKUP_INCLUDE_HOSTNAME BACKUP_KEEP_DAYS TZ; do
    if [ -n "${!var+x}" ]; then
        printf 'export %s=%q\n' "$var" "${!var}" >> /app/backup.env
    fi
done

if [ "${RUN_ON_STARTUP:-false}" = "true" ]; then
    log "RUN_ON_STARTUP is enabled, running a backup now..."
    /app/backup.sh || log "WARNING: startup backup failed"
fi

# Job output goes to PID 1's stdout, so it shows in `docker compose logs`.
echo "${SCHEDULE} . /app/backup.env && /app/backup.sh > /proc/1/fd/1 2>&1" | crontab -
log "Cron schedule: ${SCHEDULE}"

trap 'log "Shutting down..."; kill ${CRON_PID} 2>/dev/null; exit 0' SIGTERM SIGINT
crond -f -l 2 &
CRON_PID=$!
log "Backup service started"
wait ${CRON_PID}
