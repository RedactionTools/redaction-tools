"""Per IP: subscribing needs no account, and every request sends a mail to whatever
address it names, so this is what stops the form being used to flood an inbox."""

from django.conf import settings
from ninja.throttling import AnonRateThrottle


class NewsletterSubscribeThrottle(AnonRateThrottle):
    scope = "newsletter_subscribe"

    def __init__(self):
        super().__init__(settings.NEWSLETTER_SUBSCRIBE_RATE)
