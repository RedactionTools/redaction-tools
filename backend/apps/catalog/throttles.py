"""Per-account limits on the write endpoints.

`AuthRateThrottle` keys on `str(request.auth)`, and `JWTAuth` resolves a bearer
token to the `User` whose `__str__` is the email - so these are per account, not
per IP, which is what makes them meaningful rather than trivially evaded.
"""

from django.conf import settings
from ninja.throttling import AuthRateThrottle, UserRateThrottle


class CatalogReadThrottle(UserRateThrottle):
    scope = "catalog_read"

    def __init__(self):
        super().__init__(settings.CATALOG_READ_RATE)


class SubmitThrottle(AuthRateThrottle):
    scope = "catalog_submit"

    def __init__(self):
        super().__init__(settings.CATALOG_SUBMIT_RATE)


class ClaimThrottle(AuthRateThrottle):
    scope = "catalog_claim"

    def __init__(self):
        super().__init__(settings.CATALOG_CLAIM_RATE)


class ScreenshotThrottle(AuthRateThrottle):
    """Tighter than the other write limits, because each call decodes an image."""

    scope = "catalog_screenshot"

    def __init__(self):
        super().__init__(settings.CATALOG_SCREENSHOT_RATE)
