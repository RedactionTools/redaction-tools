"""Per-account limit on posting. Keyed on the account, like the catalog's write limits."""

from django.conf import settings
from ninja.throttling import AuthRateThrottle


class CommentThrottle(AuthRateThrottle):
    scope = "comments_post"

    def __init__(self):
        super().__init__(settings.COMMENTS_POST_RATE)
