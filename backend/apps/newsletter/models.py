"""Who asked to hear about new reviews, tools and benchmarks, and what they asked for.

Double opt-in: an address is `pending` until its owner clicks the confirmation link,
and only `active` rows may ever be mailed. The timestamps are the consent trail.
"""

from django.db import models

from apps.core.models import TimeStampedModel

# The topics a reader can pick, in the order the form and the emails list them.
TOPICS = {
    "reviews": "Reviews",
    "new_tools": "New tools",
    "benchmarks": "Benchmarks",
}


class Subscriber(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting confirmation"
        ACTIVE = "active", "Subscribed"
        UNSUBSCRIBED = "unsubscribed", "Unsubscribed"

    # Stored lowercased, so one inbox is one row however it was typed.
    email = models.EmailField(unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    reviews = models.BooleanField(default=False)
    new_tools = models.BooleanField(default=False)
    benchmarks = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    @property
    def topics(self) -> list[str]:
        return [topic for topic in TOPICS if getattr(self, topic)]
