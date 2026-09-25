"""Render the page preview of every case that lacks one, or of every case with --all.

For cases published before previews existed, and for re-rendering after a change to
`files.PREVIEW_DPI` or the rendition widths. Idempotent: the files are content-addressed,
so rendering the same page again writes the same paths.
"""

from django.core.management.base import BaseCommand

from apps.benchmarks import services
from apps.benchmarks.files import FileRejected
from apps.benchmarks.models import Case


class Command(BaseCommand):
    help = "Render benchmark case previews that are missing (or all of them with --all)."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Re-render every case.")

    def handle(self, *args, **options):
        cases = Case.objects.exclude(pdf="").order_by("revision", "case_id")
        if not options["all"]:
            cases = cases.filter(preview="")

        rendered = 0
        for case in cases:
            try:
                widths = services.render_preview(case)
            except (FileRejected, FileNotFoundError, OSError) as exc:
                # Reported and skipped, as rerender_screenshots does: one unreadable
                # PDF must not stop the sweep.
                self.stderr.write(f"{case.case_id}: {exc}")
                continue
            rendered += 1
            self.stdout.write(f"{case.case_id}: {', '.join(map(str, widths))}")
        self.stdout.write(self.style.SUCCESS(f"{rendered} case(s) rendered."))
