"""Mail to subscribers: the confirmation link, then a welcome once they click it.

Each is its own task, queued once the row commits. The task gets the row and the
topics, never a link: django-q keeps task arguments in the database, and a
confirmation link is a credential for that address.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction

from apps.core.email import send_templated_email
from apps.newsletter import tokens
from apps.newsletter.models import TOPICS, Subscriber


def queue_confirmation(subscriber: Subscriber, topics: list[str]) -> None:
    _queue("send_confirmation", subscriber.pk, topics)


def queue_welcome(subscriber: Subscriber) -> None:
    _queue("send_welcome", subscriber.pk)


def _queue(task, *args):
    from django_q.tasks import async_task

    transaction.on_commit(
        lambda: async_task(
            f"apps.newsletter.emails.{task}", *args, task_name=f"newsletter {task} {args[0]}"
        )
    )


def unsubscribe_url(subscriber: Subscriber) -> str:
    return _url("unsubscribe", tokens.unsubscribe_token(subscriber.pk))


def send_confirmation(subscriber_pk: int, topics: list[str]) -> None:
    subscriber = Subscriber.objects.get(pk=subscriber_pk)
    send_templated_email(
        "newsletter_confirm",
        {
            "topics": _labels(topics),
            "confirm_url": _url("confirm", tokens.confirm_token(subscriber.pk, topics)),
        },
        to=[subscriber.email],
    )


def send_welcome(subscriber_pk: int) -> None:
    subscriber = Subscriber.objects.get(pk=subscriber_pk)
    url = unsubscribe_url(subscriber)
    send_templated_email(
        "newsletter_welcome",
        {"topics": _labels(subscriber.topics), "unsubscribe_url": url},
        to=[subscriber.email],
        headers={"List-Unsubscribe": f"<{url}>"},
    )


def _url(page: str, token: str) -> str:
    return f"{settings.FRONTEND_URL}/newsletter/{page}?{urlencode({'token': token})}"


def _labels(topics: list[str]) -> list[str]:
    return [label for topic, label in TOPICS.items() if topic in topics]
