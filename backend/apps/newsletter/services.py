"""Every change to the list goes through here; the API only translates."""

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from apps.newsletter import emails, tokens
from apps.newsletter.models import TOPICS, Subscriber


class SubscribeError(Exception):
    """A request the reader can fix, shown to them verbatim."""


@transaction.atomic
def subscribe(email: str, topics: list[str]) -> None:
    """Record the request and mail a confirmation link, whatever state the address is in.

    It says nothing back either way, so the form cannot be used to learn who is on the
    list. An address already on it keeps its topics until its owner confirms the new ones.
    """
    email = email.strip().lower()
    try:
        validate_email(email)
    except ValidationError as exc:
        raise SubscribeError("Enter a valid email address.") from exc
    if not topics:
        raise SubscribeError("Pick at least one topic.")
    subscriber, _ = Subscriber.objects.select_for_update().get_or_create(email=email)
    if subscriber.status != Subscriber.Status.ACTIVE:
        subscriber.status = Subscriber.Status.PENDING
        for topic in TOPICS:
            setattr(subscriber, topic, topic in topics)
        subscriber.save()
    emails.queue_confirmation(subscriber, topics)


@transaction.atomic
def confirm(token: str) -> Subscriber:
    pk, topics = tokens.read_confirm_token(token)
    subscriber = _locked(pk)
    for topic in TOPICS:
        setattr(subscriber, topic, topic in topics)
    # An address already on the list is only changing its topics: no second welcome.
    joining = subscriber.status != Subscriber.Status.ACTIVE
    if joining:
        subscriber.status = Subscriber.Status.ACTIVE
        subscriber.confirmed_at = timezone.now()
        subscriber.unsubscribed_at = None
    subscriber.save()
    if joining:
        emails.queue_welcome(subscriber)
    return subscriber


@transaction.atomic
def unsubscribe(token: str) -> None:
    subscriber = _locked(tokens.read_unsubscribe_token(token))
    if subscriber.status != Subscriber.Status.UNSUBSCRIBED:
        subscriber.status = Subscriber.Status.UNSUBSCRIBED
        subscriber.unsubscribed_at = timezone.now()
        subscriber.save()


def _locked(pk: int) -> Subscriber:
    # A row staff deleted reads as a dead link, not a server error.
    try:
        return Subscriber.objects.select_for_update().get(pk=pk)
    except Subscriber.DoesNotExist as exc:
        raise tokens.InvalidToken from exc
