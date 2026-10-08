"""The public newsletter endpoints: subscribe from the footer, confirm, unsubscribe."""

from django.http import HttpRequest
from ninja import Router, Status
from ninja.errors import HttpError

from apps.newsletter import services
from apps.newsletter.models import TOPICS
from apps.newsletter.schemas import SubscribeIn, SubscriptionOut, TokenIn
from apps.newsletter.throttles import NewsletterSubscribeThrottle
from apps.newsletter.tokens import InvalidToken

router = Router(tags=["newsletter"])


@router.post(
    "/subscriptions",
    response={204: None},
    throttle=[NewsletterSubscribeThrottle()],
    summary="Subscribe to the newsletter",
)
def subscribe_newsletter(request: HttpRequest, payload: SubscribeIn):
    topics = [topic for topic in TOPICS if getattr(payload, topic)]
    try:
        services.subscribe(payload.email, topics)
    except services.SubscribeError as exc:
        raise HttpError(422, str(exc)) from exc
    return Status(204, None)


@router.post(
    "/confirmations", response={200: SubscriptionOut}, summary="Confirm a newsletter subscription"
)
def confirm_newsletter(request: HttpRequest, payload: TokenIn):
    try:
        subscriber = services.confirm(payload.token)
    except InvalidToken as exc:
        raise _dead_link() from exc
    return {"email": subscriber.email, "topics": subscriber.topics}


@router.post("/unsubscriptions", response={204: None}, summary="Leave the newsletter")
def unsubscribe_newsletter(request: HttpRequest, payload: TokenIn):
    try:
        services.unsubscribe(payload.token)
    except InvalidToken as exc:
        raise _dead_link() from exc
    return Status(204, None)


def _dead_link():
    return HttpError(400, "This link is invalid or has expired.")
