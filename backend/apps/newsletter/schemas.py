"""Request and response schemas for the newsletter API."""

from ninja import Schema


class SubscribeIn(Schema):
    email: str
    reviews: bool = False
    new_tools: bool = False
    benchmarks: bool = False


class TokenIn(Schema):
    token: str


class SubscriptionOut(Schema):
    email: str
    topics: list[str]
