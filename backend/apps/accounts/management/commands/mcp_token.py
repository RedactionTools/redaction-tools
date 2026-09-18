"""Mint a bearer token for the staff MCP server."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_mcpz.bearer_tokens.models import Token


class Command(BaseCommand):
    help = "Mint a bearer token for the staff MCP server at /mcp."

    def add_arguments(self, parser):
        parser.add_argument("email", help="The staff account the token acts as.")
        parser.add_argument("--name", default="cli", help="A label, shown in the admin.")
        parser.add_argument("--expires-in-days", type=int, default=None)

    def handle(self, *args, **options):
        user = get_user_model().objects.filter(email=options["email"]).first()
        if user is None:
            raise CommandError(f"No account with email {options['email']!r}.")
        if not user.is_staff:
            # Refused here rather than at the first tool call: a token that can
            # never do anything is worse than no token.
            raise CommandError(f"{user.email} is not staff; the MCP server would refuse it.")

        expires_at = None
        if options["expires_in_days"] is not None:
            from datetime import timedelta

            from django.utils import timezone

            expires_at = timezone.now() + timedelta(days=options["expires_in_days"])

        _, value = Token.create(name=options["name"], user=user, expires_at=expires_at)
        # Shown once and never again: only the digest is stored.
        self.stdout.write(value)
