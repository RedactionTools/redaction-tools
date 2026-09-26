"""The public benchmark reads: suites, the leaderboard, cases, tool reports, runs."""

import json

import pytest
from django.utils import timezone

from apps.benchmarks import services
from apps.benchmarks.models import RunStatus, SubmissionOrigin, SubmissionStatus

pytestmark = pytest.mark.django_db

BASE = "/api/v1/benchmarks"


@pytest.fixture
def published(owner, benchmark_case, run_files):
    """The fixture run, published from the CLI by the tool's owner and approved."""
    submission = services.open_submission(
        user=owner, suite="pdf", tool="pdf-redaction", surface="web", origin=SubmissionOrigin.CLI
    )
    run = services.add_scored_run(
        user=owner,
        submission=submission,
        manifest=run_files["manifest"],
        report=run_files["report"],
        overlay=run_files["overlay"],
        pdf=run_files["pdf"],
    )
    run.status = RunStatus.SCORED
    run.verification = "verified"
    run.save()
    submission.status = SubmissionStatus.APPROVED
    submission.reviewed_at = timezone.now()
    submission.save()
    return run


def test_the_suites_list_offers_pdf(client, benchmark_case):
    [suite] = client.get(f"{BASE}/suites").json()

    assert suite["slug"] == "pdf"
    assert suite["current_revision"] == "v0.1.1"
    assert suite["case_count"] == 1


def test_a_suite_page_carries_its_cases_the_case_pack_and_the_leaderboard(client, published):
    body = client.get(f"{BASE}/suites/pdf").json()

    assert body["revision"]["revision"] == "v0.1.1"
    assert body["revision"]["case_pack_url"].endswith(".zip")
    [case] = body["cases"]
    assert case["case_id"] == "extraction-conditions-1"
    assert case["pdf_url"].startswith("http://localhost:8007/media/benchmarks/")
    [row] = body["leaderboard"]
    assert row["tool"] == {
        "slug": "pdf-redaction",
        "name": row["tool"]["name"],
        "logo_url": row["tool"]["logo_url"],
        "listable": True,
    }
    assert row["leak_rate"]["count"] == 12
    assert row["submitters"] == [{"name": "Tool Owner", "role": "owner"}]
    assert row["provenance"] == "verified"


def test_an_unknown_suite_is_a_404(client):
    assert client.get(f"{BASE}/suites/audio").status_code == 404


def test_a_case_page_lists_every_tools_run_on_it(client, published):
    body = client.get(f"{BASE}/suites/pdf/cases/extraction-conditions-1").json()

    assert body["probe_summary"]["by_channel"] == {"image_text": 27, "text_layer": 27}
    assert body["preview"]["url"].endswith("/preview.png")
    assert body["preview"]["srcset"].endswith("960w")
    assert abs(body["preview"]["width"] - 1240) <= 1
    [run] = body["runs"]
    assert run["run_id"] == published.run_id
    assert run["overlay"]["url"].endswith("overlay.png")
    assert run["overlay"]["srcset"].endswith("480w")
    assert run["output_pdf_url"].endswith("redacted-extraction-conditions-1.pdf")
    assert run["submitter"] == {"name": "Tool Owner", "role": "owner"}


def test_a_holdout_case_has_no_page(client, staff_user, case_files, benchmark_case):
    pdf, truth = case_files
    services.publish_case(
        user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth, visibility="holdout"
    )

    response = client.get(f"{BASE}/suites/pdf/cases/extraction-conditions-1")

    assert response.status_code == 404
    assert client.get(f"{BASE}/suites/pdf").json()["cases"] == []


def test_a_tool_report_pools_the_breakdowns_of_its_runs(client, published):
    body = client.get(f"{BASE}/suites/pdf/tools/pdf-redaction").json()

    [surface] = body["surfaces"]
    assert surface["surface"] == "web"
    assert surface["summary"]["leak_rate"]["count"] == 12
    assert surface["breakdowns"]["by_category"]["PERSON"]["leak_rate"]["count"] == 12
    assert surface["breakdowns"]["layers"]["rendered_pixels"]["layer_leak_rate"]["n"] == 54
    assert surface["breakdowns"]["reach"]["text_layer"]["n"] == 27
    [run] = surface["runs"]
    assert run["weighted_leak_rate"] == pytest.approx(0.222222)


def test_a_tool_with_no_approved_runs_has_no_report(client, benchmark_case):
    assert client.get(f"{BASE}/suites/pdf/tools/adobe-acrobat").status_code == 404


def test_a_run_page_carries_the_whole_report(client, published):
    body = client.get(f"{BASE}/runs/{published.run_id}").json()

    assert body["report"]["alignment"]["method"] == "fiducial"
    assert body["manifest"]["tool_id"] == "pdf-redaction:web"
    assert body["verification"] == "verified"
    assert body["scored_by"] == "submitter"


def test_a_run_not_yet_approved_is_not_public(client, published):
    published.submission.status = SubmissionStatus.PENDING_REVIEW
    published.submission.save()

    assert client.get(f"{BASE}/runs/{published.run_id}").status_code == 404
    assert client.get(f"{BASE}/suites/pdf").json()["leaderboard"] == []


def test_no_public_response_carries_the_ground_truth(client, published):
    """The seed regenerates a case and the probe values are its answers: neither may
    appear anywhere the public can read."""
    responses = [
        client.get(f"{BASE}/suites"),
        client.get(f"{BASE}/suites/pdf"),
        client.get(f"{BASE}/suites/pdf/cases/extraction-conditions-1"),
        client.get(f"{BASE}/suites/pdf/tools/pdf-redaction"),
        client.get(f"{BASE}/runs/{published.run_id}"),
    ]
    for response in responses:
        assert response.status_code == 200
        text = json.dumps(response.json())
        assert '"seed"' not in text
        assert "Freya Yamamoto" not in text
        assert '"probes": [' not in text


def test_a_tool_page_names_the_suites_it_has_results_in(client, published):
    """So the catalog profile can link to the tool's benchmark report."""
    body = client.get("/api/v1/catalog/tools/pdf-redaction").json()

    assert body["benchmarks"] == [{"suite": "pdf", "name": body["benchmarks"][0]["name"]}]


def test_a_tool_page_names_no_suite_before_a_result_is_approved(client, published):
    published.submission.status = SubmissionStatus.PENDING_REVIEW
    published.submission.save()

    body = client.get("/api/v1/catalog/tools/pdf-redaction").json()

    assert body["benchmarks"] == []
