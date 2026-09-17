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


def check_external_urls(payload, fields):
    """Run the SSRF guard over every user-supplied URL, reporting per field.

    Model validators only fire on `full_clean()`, which the ORM does not call on
    save - so the API boundary has to run them itself.
    """
    errors = []
    for field in fields:
        value = getattr(payload, field, "") or ""
        if not value:
            continue
        validator = validate_logo_url if field.endswith("logo_url") else validate_external_url
        try:
            validator(value)
        except DjangoValidationError as exc:
            errors.append({"type": "value_error", "loc": ["body", field], "msg": exc.messages[0]})
    if errors:
        raise ValidationError(errors)


def conflict(detail):
    return HttpError(409, detail)
