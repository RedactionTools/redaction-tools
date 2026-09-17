from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base for domain models: every row records when it was created and changed."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
