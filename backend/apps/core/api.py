from django.db import connection
from django.http import HttpRequest
from ninja import Router, Schema

router = Router(tags=["core"])


class HealthSchema(Schema):
    status: str
    database: str


@router.get("/health", response=HealthSchema, summary="Liveness/readiness probe")
def health(request: HttpRequest):
    try:
        connection.ensure_connection()
    except Exception:  # noqa: BLE001 - report any driver error as a degraded database
        return {"status": "degraded", "database": "unavailable"}
    return {"status": "ok", "database": "ok"}
