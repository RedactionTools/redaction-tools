"""Re-render every screenshot from its stored source.

What makes `images.VARIANT_WIDTHS` something that can be changed: the sources
are kept, so adding a width is a sweep over rows rather than a request to every
vendor for a fresh capture. Idempotent - a screenshot already rendered at every
declared width is written again with the same bytes at the same paths.
"""

from django.core.management.base import BaseCommand

from apps.catalog import screenshots
from apps.catalog.images import ImageRejected
from apps.catalog.models import ToolScreenshot


class Command(BaseCommand):
    help = "Re-render stored screenshots at the currently declared widths."

    def add_arguments(self, parser):
        parser.add_argument("--tool", help="Limit to one listing, by slug.")

    def handle(self, *args, **options):
        queryset = ToolScreenshot.objects.select_related("tool").order_by("pk")
        if options["tool"]:
            queryset = queryset.filter(tool__slug=options["tool"])

        rendered, failed = 0, 0
        for shot in queryset:
            try:
                widths = screenshots.rerender(shot)
            except (ImageRejected, FileNotFoundError, OSError) as exc:
                # Reported and skipped rather than fatal: one unreadable source
                # must not stop the sweep, and the row names itself so the
                # missing file can be replaced.
                failed += 1
                self.stderr.write(f"{shot.pk} ({shot.tool.slug}): {exc}")
                continue
            rendered += 1
            self.stdout.write(f"{shot.pk} ({shot.tool.slug}): {', '.join(map(str, widths))}")

        summary = f"Re-rendered {rendered} screenshots, {failed} failed."
        self.stdout.write(self.style.SUCCESS(summary))
