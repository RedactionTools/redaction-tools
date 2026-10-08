"""Per-account limit on guest posts. Keyed on the account, like the comment throttle."""

from django.conf import settings
from ninja.throttling import AuthRateThrottle


class PostSubmissionThrottle(AuthRateThrottle):
    scope = "blog_submission"

    def __init__(self):
        super().__init__(settings.BLOG_SUBMISSION_RATE)
