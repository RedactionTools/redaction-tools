"""Signed links, so nothing secret is stored and nothing needs cleaning up.

The confirmation carries the topics as well as the row: re-subscribing an address
that is already on the list changes nothing until its owner clicks, so a stranger
cannot rewrite someone else's choices. It expires; the unsubscribe link does not,
because every mail we ever send carries one.
"""

from datetime import timedelta

from django.core import signing

CONFIRM_MAX_AGE = timedelta(days=7)
_CONFIRM_SALT = "newsletter-confirm"
_UNSUBSCRIBE_SALT = "newsletter-unsubscribe"


class InvalidToken(Exception):
    pass


def confirm_token(subscriber_pk: int, topics: list[str]) -> str:
    return signing.dumps({"id": subscriber_pk, "topics": topics}, salt=_CONFIRM_SALT)


def read_confirm_token(token: str) -> tuple[int, list[str]]:
    try:
        data = signing.loads(token, salt=_CONFIRM_SALT, max_age=CONFIRM_MAX_AGE)
    except signing.BadSignature as exc:  # SignatureExpired is a subclass
        raise InvalidToken from exc
    return data["id"], data["topics"]


def unsubscribe_token(subscriber_pk: int) -> str:
    return signing.dumps(subscriber_pk, salt=_UNSUBSCRIBE_SALT)


def read_unsubscribe_token(token: str) -> int:
    try:
        return signing.loads(token, salt=_UNSUBSCRIBE_SALT)
    except signing.BadSignature as exc:
        raise InvalidToken from exc
