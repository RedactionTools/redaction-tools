"""Logic the write endpoints share."""

from urllib.parse import urlparse

from django.core.exceptions import ValidationError as DjangoValidationError
from ninja.errors import HttpError, ValidationError

from apps.catalog.validators import validate_external_url, validate_logo_url


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR")


def normalize_host(url: str) -> str:
    """Lowercased host with a leading `www.` stripped.

    adobe.com and www.adobe.com/anything are the same vendor site, and treating
    them as different is how a catalog ends up listing one tool twice.
    """
    host = (urlparse(url or "").hostname or "").lower()
    return host.removeprefix("www.")


def external_url_errors(values, fields):
    """Every (field, message) the SSRF guard objects to, over a mapping.

    Model validators only fire on `full_clean()`, which the ORM does not call on
    save - so every write boundary has to run them itself. Returned rather than
    raised, because not every boundary is a ninja view: the staff MCP surface
    needs the same check and a different exception.
    """
    errors = []
    for field in fields:
        value = values.get(field) or ""
        if not value:
            continue
        validator = validate_logo_url if field.endswith("logo_url") else validate_external_url
        try:
            validator(value)
        except DjangoValidationError as exc:
            errors.append((field, exc.messages[0]))
    return errors


def check_external_urls(payload, fields):
    """`external_url_errors` over a schema object, as a ninja 422."""
    values = {field: getattr(payload, field, "") for field in fields}
    errors = external_url_errors(values, fields)
    if errors:
        raise ValidationError(
            [
                {"type": "value_error", "loc": ["body", field], "msg": message}
                for field, message in errors
            ]
        )


def conflict(detail):
    return HttpError(409, detail)
