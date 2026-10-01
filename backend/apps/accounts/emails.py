"""Mail sent about an account."""

from allauth.account.signals import user_signed_up
from django.contrib.auth import get_user_model
from django.db import transaction
from django.dispatch import receiver

from apps.core.email import send_templated_email


@receiver(user_signed_up)
def welcome_new_user(sender, request, user, **kwargs):
    """Queue the welcome email once the signup has committed.

    Queued rather than sent inline: signing in must not wait on, or fail with, the
    mail provider. After commit, so a signup that rolls back welcomes no one.
    """
    from django_q.tasks import async_task

    transaction.on_commit(
        lambda: async_task(
            "apps.accounts.emails.send_welcome_email", user.pk, task_name=f"welcome {user.pk}"
        )
    )


def send_welcome_email(user_pk):
    user = get_user_model().objects.get(pk=user_pk)
    send_templated_email("welcome", {"name": user.name}, to=[user.email])
