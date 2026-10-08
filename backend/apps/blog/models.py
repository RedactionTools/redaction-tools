from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class PostSubmissionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"


class PostSubmission(TimeStampedModel):
    """A guest post awaiting review. Accepting one publishes nothing: posts are MDX
    in the frontend, so an editor still turns it into a file and commits it."""

    title = models.CharField(max_length=200)
    description = models.CharField(max_length=300, help_text="The post's summary line.")
    tags = models.JSONField(default=list, blank=True)
    body_md = models.TextField(help_text="Raw markdown. Never rendered as HTML on the backend.")

    author_name = models.CharField(max_length=120)
    author_role = models.CharField(max_length=120, blank=True)
    author_bio = models.TextField(blank=True)
    author_links = models.JSONField(default=list, blank=True)

    # Login is required, so identity is the account rather than a typed address.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_submissions"
    )
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    status = models.CharField(
        max_length=16,
        choices=PostSubmissionStatus.choices,
        default=PostSubmissionStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, help_text="Shown to the submitter.")

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title
