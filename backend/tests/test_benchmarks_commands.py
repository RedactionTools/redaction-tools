"""`manage.py render_case_previews`: previews for cases published before they existed."""

import io

import pytest
from django.core.management import call_command

from apps.benchmarks.models import Case

pytestmark = pytest.mark.django_db


def test_renders_a_preview_for_a_case_that_has_none(benchmark_case):
    Case.objects.filter(pk=benchmark_case.pk).update(preview="", preview_widths=[])
    out = io.StringIO()

    call_command("render_case_previews", stdout=out)

    benchmark_case.refresh_from_db()
    assert benchmark_case.preview.name.endswith("/preview.png")
    assert "extraction-conditions-1: 480, 960" in out.getvalue()


def test_leaves_a_case_that_has_one_unless_asked(benchmark_case):
    out = io.StringIO()

    call_command("render_case_previews", stdout=out)

    assert "0 case(s) rendered" in out.getvalue()
