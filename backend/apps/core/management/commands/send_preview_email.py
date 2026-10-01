"""Send an email filled with its sample data, to look at it in Mailpit.

uv run manage.py send_preview_email claim_code
uv run manage.py send_preview_email --all --to you@example.com
"""

import json

from django.core.management import BaseCommand, CommandError

from apps.core.email import EMAIL_TEMPLATE_DIR, email_names, send_templated_email


class Command(BaseCommand):
    help = "Send email templates with their preview.json sample data."

    def add_arguments(self, parser):
        parser.add_argument("names", nargs="*", help="Emails to send, e.g. claim_code")
        parser.add_argument("--all", action="store_true", help="Send every email")
        parser.add_argument("--to", default="dev@example.com", help="Recipient")

    def handle(self, *args, names, all, to, **options):
        known = email_names()
        names = known if all else names
        if not names:
            raise CommandError(f"Name an email or pass --all. Emails: {', '.join(known)}")
        if unknown := sorted(set(names) - set(known)):
            raise CommandError(f"No such email: {', '.join(unknown)}. Emails: {', '.join(known)}")

        for name in names:
            context = json.loads((EMAIL_TEMPLATE_DIR / name / "preview.json").read_text())
            send_templated_email(name, context, to=[to])
            self.stdout.write(f"sent {name} to {to}")
