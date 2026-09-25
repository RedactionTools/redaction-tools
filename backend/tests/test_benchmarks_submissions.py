"""Opening a submission and filling it: redacted PDFs for us to score, or runs the
submitter already scored with the CLI."""

import copy
import io
import re

import pytest
from django.contrib.auth import get_user_model

from apps.benchmarks import services
from apps.benchmarks.models import (
    Run,
    RunStatus,
    ScoredBy,
    SubmissionOrigin,
    SubmissionStatus,
    SubmitterRole,
    Verification,
)
from apps.benchmarks.services import BenchmarkError

pytestmark = pytest.mark.django_db


def _open(user, origin=SubmissionOrigin.UPLOAD, tool="pdf-redaction", surface="web"):
    return services.open_submission(
        user=user, suite="pdf", tool=tool, surface=surface, origin=origin
    )


# --- who published it --------------------------------------------------------


def test_staff_publish_as_redaction_tools(staff_user, benchmark_case):
    submission = _open(staff_user)

    assert submission.submitter_role == SubmitterRole.STAFF
    assert submission.submitter_name == "Staff"
    assert submission.submitted_by == staff_user


def test_an_approved_owner_publishes_as_the_tool_owner(owner, benchmark_case):
    assert _open(owner).submitter_role == SubmitterRole.OWNER


def test_an_owner_of_one_tool_is_community_on_another(owner, benchmark_case):
    assert _open(owner, tool="adobe-acrobat").submitter_role == SubmitterRole.COMMUNITY


def test_anyone_else_publishes_as_community(user, benchmark_case):
    submission = _open(user)

    assert submission.submitter_role == SubmitterRole.COMMUNITY
    assert submission.submitter_name == "Test User"


def test_an_account_with_no_name_is_not_shown_by_its_email(benchmark_case):
    nameless = get_user_model().objects.create_user(email="private@example.com")

    assert "private" not in _open(nameless).submitter_name


def test_a_staff_account_with_no_name_publishes_as_redaction_tools(benchmark_case):
    nameless = get_user_model().objects.create_user(email="ops@example.com", is_staff=True)

    assert _open(nameless).submitter_name == "Redaction Tools"


# --- what it is for -----------------------------------------------------------


def test_a_submission_targets_the_current_revision(user, benchmark_case):
    submission = _open(user)

    assert submission.revision == benchmark_case.revision
    assert submission.status == SubmissionStatus.DRAFT
    assert submission.tool_id_label == "pdf-redaction:web"


def test_a_tool_the_catalog_does_not_have_is_refused_by_name(user, benchmark_case):
    with pytest.raises(BenchmarkError, match="no-such-tool"):
        _open(user, tool="no-such-tool")


def test_a_surface_pdfredeval_does_not_know_is_refused(user, benchmark_case):
    with pytest.raises(BenchmarkError, match="surface"):
        _open(user, surface="mobile")


def test_a_suite_with_no_cases_yet_takes_no_submissions(user):
    with pytest.raises(BenchmarkError, match="no cases"):
        _open(user)


# --- uploaded outputs, scored by us -------------------------------------------


def test_an_uploaded_output_queues_a_run_with_a_manifest_we_wrote(user, benchmark_case, run_files):
    submission = _open(user)

    run = services.add_output(
        user=user, submission=submission, case_id=benchmark_case.case_id, pdf=run_files["pdf"]
    )

    assert run.status == RunStatus.QUEUED
    assert run.scored_by == ScoredBy.SERVER
    assert run.verification == Verification.NOT_NEEDED
    assert run.manifest["tool_id"] == "pdf-redaction:web"
    assert run.manifest["case_id"] == benchmark_case.case_id
    assert run.manifest["dataset_revision"] == "v0.1.1"
    assert run.manifest["input_sha256"] == benchmark_case.input_sha256
    assert run.manifest["output_sha256"] == run.output_sha256
    # pdfredeval's own run-id format, so a run uploaded here reads like one from the CLI.
    assert re.fullmatch(
        r"\d{8}T\d{6}-pdf-redaction-web-extraction-conditions-1-a1-[0-9a-f]{6}", run.run_id
    )


def test_uploading_a_case_again_replaces_its_run(user, benchmark_case, run_files):
    submission = _open(user)
    for _ in range(2):
        services.add_output(
            user=user, submission=submission, case_id=benchmark_case.case_id, pdf=run_files["pdf"]
        )

    assert submission.runs.count() == 1


def test_an_output_for_a_case_not_in_the_revision_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="pii-detection-9"):
        services.add_output(
            user=user, submission=_open(user), case_id="pii-detection-9", pdf=run_files["pdf"]
        )


def test_only_staff_submit_against_a_holdout_case(
    user, staff_user, case_files, benchmark_case, run_files
):
    pdf, truth = case_files
    services.publish_case(
        user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth, visibility="holdout"
    )

    with pytest.raises(BenchmarkError, match=benchmark_case.case_id):
        services.add_output(
            user=user, submission=_open(user), case_id=benchmark_case.case_id, pdf=run_files["pdf"]
        )
    services.add_output(
        user=staff_user,
        submission=_open(staff_user),
        case_id=benchmark_case.case_id,
        pdf=run_files["pdf"],
    )


def test_an_output_with_a_different_page_count_is_refused(user, benchmark_case):
    with pytest.raises(BenchmarkError, match="2 pages"):
        services.add_output(
            user=user, submission=_open(user), case_id=benchmark_case.case_id, pdf=_pages(2)
        )


def test_nobody_adds_to_someone_elses_submission(user, owner, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="not yours"):
        services.add_output(
            user=user, submission=_open(owner), case_id=benchmark_case.case_id, pdf=run_files["pdf"]
        )


def test_a_submission_already_sent_takes_no_more_files(user, benchmark_case, run_files):
    submission = _open(user)
    submission.status = SubmissionStatus.PENDING_REVIEW
    submission.save()

    with pytest.raises(BenchmarkError, match="already"):
        services.add_output(
            user=user, submission=submission, case_id=benchmark_case.case_id, pdf=run_files["pdf"]
        )


# --- runs scored with the CLI -------------------------------------------------


def _publish(user, run_files, **changes):
    files = copy.deepcopy(run_files)
    for key, value in changes.items():
        part, _, field = key.partition("__")
        files[part][field] = value
    return services.add_scored_run(
        user=user,
        submission=_open(user, origin=SubmissionOrigin.CLI),
        manifest=files["manifest"],
        report=files["report"],
        overlay=files["overlay"],
        pdf=files["pdf"],
    )


def test_a_cli_run_keeps_the_submitters_report_and_awaits_our_rescore(
    user, benchmark_case, run_files
):
    run = _publish(user, run_files)

    assert run.run_id == run_files["manifest"]["run_id"]
    assert run.scored_by == ScoredBy.SUBMITTER
    assert run.verification == Verification.PENDING
    assert run.report == run_files["report"]
    assert (run.tp, run.fn, run.fp, run.tn) == (42, 12, 0, 0)
    assert run.text_retention == pytest.approx(0.931835)
    assert run.overlay.name.endswith("overlay.png")
    assert run.overlay_widths == [480]


def test_a_cli_run_for_another_tool_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="ai-redact:web"):
        _publish(user, run_files, manifest__tool_id="ai-redact:web")


def test_a_cli_run_whose_pdf_is_not_the_one_it_scored_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="output_sha256"):
        _publish(user, run_files, manifest__output_sha256="0" * 64)


def test_a_cli_run_of_some_other_input_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="input_sha256"):
        _publish(user, run_files, manifest__input_sha256="0" * 64)


def test_a_cli_run_from_another_revision_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match=r"v0\.0\.9"):
        _publish(user, run_files, manifest__dataset_revision="v0.0.9")


def test_a_manifest_carrying_a_credential_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="credential"):
        _publish(user, run_files, manifest__vendor_settings={"api_key": "sk-live"})


def test_an_incomplete_manifest_is_refused_by_field(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="observed_at"):
        _publish(user, run_files, manifest__observed_at=None)


def test_a_report_for_a_different_run_is_refused(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="run_id"):
        _publish(user, run_files, report__run_id="someone-elses-run")


def test_a_run_id_is_published_once(user, benchmark_case, run_files):
    _publish(user, run_files)

    with pytest.raises(BenchmarkError, match="already published"):
        _publish(user, run_files)
    assert Run.objects.count() == 1


def test_a_cli_run_cannot_go_into_an_upload_submission(user, benchmark_case, run_files):
    with pytest.raises(BenchmarkError, match="CLI"):
        services.add_scored_run(
            user=user,
            submission=_open(user),
            manifest=run_files["manifest"],
            report=run_files["report"],
            overlay=run_files["overlay"],
            pdf=run_files["pdf"],
        )


def _pages(count):
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(count):
        writer.add_blank_page(width=595.28, height=841.89)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()
