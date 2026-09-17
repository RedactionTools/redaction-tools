"""Schemas shared across apps."""

from ninja import Schema


class ErrorSchema(Schema):
    """The body every documented 4xx carries.

    Ninja documents only the success shape by default, so an error shape that the
    frontend branches on has to be declared explicitly on the route.
    """

    detail: str
