"""What a benchmark file may be, and where it lands in storage."""

import hashlib
import pathlib

import pytest
from django.core.files.storage import default_storage

from apps.benchmarks import files
from apps.benchmarks.files import FileRejected

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "benchmarks"
CASE_PDF = (FIXTURES / "case" / "extraction-conditions-1.pdf").read_bytes()
OVERLAY_PNG = (FIXTURES / "run" / "overlay.png").read_bytes()


def test_a_pdf_is_stored_under_its_own_digest():
    stored = files.store_pdf(CASE_PDF, "extraction-conditions-1.pdf")

    digest = hashlib.sha256(CASE_PDF).hexdigest()
    assert stored.path == f"benchmarks/{digest}/extraction-conditions-1.pdf"
    assert stored.sha256 == digest
    assert stored.page_count == 1
    assert default_storage.open(stored.path).read() == CASE_PDF


def test_storing_the_same_pdf_twice_writes_one_file_at_one_path():
    first = files.store_pdf(CASE_PDF, "case.pdf")
    second = files.store_pdf(CASE_PDF, "case.pdf")

    assert first.path == second.path


def test_bytes_that_are_not_a_pdf_are_refused():
    with pytest.raises(FileRejected, match="not a PDF"):
        files.store_pdf(b"<html>hello</html>", "case.pdf")


def test_a_pdf_over_the_size_cap_is_refused_before_it_is_parsed(settings):
    settings.BENCHMARK_MAX_PDF_BYTES = 1024

    with pytest.raises(FileRejected, match="larger than"):
        files.store_pdf(CASE_PDF, "case.pdf")


def test_a_truncated_pdf_is_refused():
    with pytest.raises(FileRejected, match="could not be read"):
        files.store_pdf(CASE_PDF[:2000], "case.pdf")


def test_an_overlay_keeps_its_png_and_gets_webp_renditions_it_can_fill():
    stored = files.store_overlay(OVERLAY_PNG)

    assert stored.path.startswith("benchmarks/") and stored.path.endswith("/overlay.png")
    assert stored.widths == [480]
    assert default_storage.exists(stored.path.replace("overlay.png", "w480.webp"))


def test_a_file_that_is_not_an_image_is_refused_as_an_overlay():
    with pytest.raises(FileRejected):
        files.store_overlay(b"not a png")
