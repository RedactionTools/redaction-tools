"""Publishing a case: staff send the PDF and its ground truth, the site keeps both and
shows only what the ground truth adds up to."""

import io
import zipfile

import pytest
from django.core.files.storage import default_storage
from PIL import Image

from apps.benchmarks import services
from apps.benchmarks.models import Case, CaseVisibility, DatasetRevision
from apps.benchmarks.services import BenchmarkError

pytestmark = pytest.mark.django_db


def test_a_published_case_lands_in_the_revision_its_ground_truth_names(benchmark_case):
    assert benchmark_case.case_id == "extraction-conditions-1"
    assert benchmark_case.family == "extraction-conditions"
    assert benchmark_case.revision.revision == "v0.1.1"
    assert benchmark_case.revision.generator_version == "0.1.1"
    assert benchmark_case.page_count == 1
    assert default_storage.exists(benchmark_case.pdf.name)


def test_the_first_revision_of_a_suite_becomes_its_current_one(benchmark_case):
    assert benchmark_case.revision.is_current


def test_the_public_summary_counts_the_probes_without_carrying_them(benchmark_case):
    summary = benchmark_case.probe_summary

    assert benchmark_case.probe_count == 54
    assert summary["targets"] == 54
    assert summary["distractors"] == 0
    assert summary["by_channel"] == {"image_text": 27, "text_layer": 27}
    assert summary["by_category"] == {"PERSON": 54}
    assert "seed" not in str(summary) and "Freya" not in str(summary)


def test_a_published_case_gets_a_preview_of_its_page(benchmark_case):
    """The PDF itself cannot be framed (media is served X-Frame-Options: DENY), so the
    page is rendered once, at publication, and served as an image."""
    assert benchmark_case.preview.name.endswith("/preview.png")
    assert benchmark_case.preview_widths == [480, 960]
    with default_storage.open(benchmark_case.preview.name) as handle:
        image = Image.open(io.BytesIO(handle.read()))
    # A4 at 150 dpi: wide enough to read a planted value, and the aspect is the page's.
    assert abs(image.width - 1240) <= 1  # 595.28pt at 150dpi is 1240.17px; pdfium rounds up
    assert abs(image.height / image.width - 841.89 / 595.28) < 0.01


def test_publishing_the_same_case_again_updates_it(staff_user, case_files, benchmark_case):
    pdf, truth = case_files

    again = services.publish_case(
        user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth, visibility="holdout"
    )

    assert again.pk == benchmark_case.pk
    assert Case.objects.count() == 1
    assert again.visibility == CaseVisibility.HOLDOUT


def test_only_staff_publish_cases(user, case_files):
    pdf, truth = case_files

    with pytest.raises(BenchmarkError, match="staff"):
        services.publish_case(user=user, suite="pdf", pdf=pdf, ground_truth=truth)


def test_a_pdf_that_is_not_the_case_its_ground_truth_describes_is_refused(staff_user, case_files):
    _, truth = case_files

    with pytest.raises(BenchmarkError, match="page size"):
        services.publish_case(user=staff_user, suite="pdf", pdf=_letter_page(), ground_truth=truth)


def test_the_case_pack_zips_every_public_case_and_no_holdout(staff_user, case_files):
    pdf, truth = case_files
    services.publish_case(user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth)
    revision = DatasetRevision.objects.get(revision="v0.1.1")

    with default_storage.open(revision.case_pack.name) as handle:
        names = zipfile.ZipFile(io.BytesIO(handle.read())).namelist()
    assert names == ["extraction-conditions/extraction-conditions-1.pdf"]

    services.publish_case(
        user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth, visibility="holdout"
    )
    revision.refresh_from_db()
    assert not revision.case_pack


def _letter_page():
    """A valid one-page PDF of the wrong size: US Letter, where cases are A4."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()
