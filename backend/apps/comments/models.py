"""Reader comments on tool pages and blog posts.

A comment hangs off exactly one target: a catalog `Tool`, or a blog post named
by its slug. The blog lives in the frontend as MDX, so there is no row to point
a key at - a slug is all the backend can know about a post.
"""

from django.conf import settings
from django.db import models

from apps.catalog.models import Tool
from apps.core.models import TimeStampedModel


class CommentStatus(models.TextChoices):
    PENDING = "pending", "Pending review"
    PUBLISHED = "published", "Published"
    REJECTED = "rejected", "Rejected"
    # Deleted by its author, or taken down by staff after it was published. The
    # row stays, blanked, so the replies under it keep their thread.
    REMOVED = "removed", "Removed"


class CommentTarget(models.TextChoices):
    TOOL = "tool", "Tool page"
    BLOG = "blog", "Blog post"


class Comment(TimeStampedModel):
    tool = models.ForeignKey(
        Tool, null=True, blank=True, on_delete=models.CASCADE, related_name="comments"
    )
    blog_slug = models.SlugField(max_length=120, blank=True, default="")

    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies"
    )
    depth = models.PositiveSmallIntegerField(default=0, help_text="0 for a top-level comment.")

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    body = models.TextField(help_text="Plain text. Never rendered as HTML or markdown.")
    edited_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=16,
        choices=CommentStatus.choices,
        default=CommentStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tool__isnull=False, blog_slug="")
                    | (models.Q(tool__isnull=True) & ~models.Q(blog_slug=""))
                ),
                name="comment_has_one_target",
            )
        ]
        indexes = [
            models.Index(fields=["tool", "status", "created_at"]),
            models.Index(fields=["blog_slug", "status", "created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"Comment {self.pk} on {self.target_type}:{self.target_slug}"

    @property
    def target_type(self):
        return CommentTarget.TOOL if self.tool_id else CommentTarget.BLOG

    @property
    def target_slug(self):
        return self.tool.slug if self.tool_id else self.blog_slug


class CommentSettings(models.Model):
    """How new comments are moderated. One row, editable at runtime by staff.

    A model rather than a setting because flipping auto-approve during a spam
    wave, or after one, must not wait on a deploy.
    """

    auto_approve = models.BooleanField(
        default=False, help_text="Publish every new comment without review."
    )
    trusted_after = models.PositiveSmallIntegerField(
        default=3,
        help_text="Published comments after which an account skips review. 0 turns this off.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "comment settings"

    def __str__(self):
        return "Comment settings"

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]
