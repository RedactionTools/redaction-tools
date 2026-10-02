# Only ever runs pg_dump/psql against the compose `db` service, so a plain
# Alpine base with the client package rather than the postgres image, which
# carries the whole server. The client's major version must be at least the
# server's (postgres:17-alpine in docker-compose-prod.yml) - pg_dump refuses
# to dump a newer server.
FROM alpine:3.24

# The MinIO client talks to any S3-compatible endpoint - AWS, MinIO, R2 - in
# one Go binary, where aws-cli would pull in a Python runtime. Alpine ships it
# as `mcli`; dl.min.io no longer serves the `mc` binaries (410 Gone), so take
# the package and keep the familiar name.
RUN apk add --no-cache \
    postgresql17-client \
    minio-client \
    dcron \
    pigz \
    zstd \
    ca-certificates \
    bash \
    && ln -s /usr/bin/mcli /usr/local/bin/mc

WORKDIR /app
COPY backup.sh restore.sh entrypoint.sh /app/
RUN chmod +x /app/*.sh && mkdir -p /tmp/backups

ENTRYPOINT ["/app/entrypoint.sh"]
