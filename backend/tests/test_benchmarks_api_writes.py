"""Publishing through the API: the site's upload form (JWT) and the CLI (API key)."""

import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.benchmarks.models import Case, Submission, SubmissionStatus

pytestmark = pytest.mark.django_db

BASE = "/api/v1/benchmarks"


def _create(client, auth, **body):
    payload = {"tool": "pdf-redaction", "surface": "web", "origin": "upload", **body}
    return client.post(
        f"{BASE}/suites/pdf/submissions", payload, content_type="application/json", **auth
    )


def _pdf(data, name="redacted.pdf"):
    return SimpleUploadedFile(name, data, content_type="application/pdf")


def _json(data, name):
    return SimpleUploadedFile(name, json.dumps(data).encode(), content_type="application/json")


# --- opening a submission --------------------------------------------------------


def test_the_cli_opens_a_submission_with_an_api_key(client, api_key, benchmark_case):
    response = _create(client, api_key, origin="cli")

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert body["origin"] == "cli"
    assert body["tool"]["slug"] == "pdf-redaction"
    assert body["submitter"] == {"name": "Test User", "role": "community"}


def test_the_site_opens_one_with_a_bearer_token(client, bearer, benchmark_case):
    assert _create(client, bearer).status_code == 201


def test_nobody_anonymous_opens_one(client, benchmark_case):
    assert _create(client, {}).status_code == 401


def test_a_refusal_comes_back_as_a_422_that_says_why(client, api_key, benchmark_case):
    response = _create(client, api_key, tool="no-such-tool")

    assert response.status_code == 422
    assert "no-such-tool" in response.json()["detail"]


# --- filling it --------------------------------------------------------------------


@pytest.fixture
def draft(client, bearer, benchmark_case):
    return _create(client, bearer).json()["id"]


def test_an_output_is_uploaded_per_case(client, bearer, draft, run_files):
    response = client.post(
        f"{BASE}/submissions/{draft}/outputs",
        {"case_id": "extraction-conditions-1", "pdf": _pdf(run_files["pdf"])},
        **bearer,
    )

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert response.json()["case_id"] == "extraction-conditions-1"


def test_an_oversized_output_is_refused_before_it_is_read(client, bearer, draft, settings):
    settings.BENCHMARK_MAX_PDF_BYTES = 10

    response = client.post(
        f"{BASE}/submissions/{draft}/outputs",
        {"case_id": "extraction-conditions-1", "pdf": _pdf(b"%PDF-" + b"0" * 64)},
        **bearer,
    )

    assert response.status_code == 422
    assert "limit" in response.json()["detail"]


def test_someone_elses_submission_is_a_404(client, draft, run_files, owner):
    from apps.accounts import jwt

    other = {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(owner)}"}}
    response = client.post(
        f"{BASE}/submissions/{draft}/outputs",
        {"case_id": "extraction-conditions-1", "pdf": _pdf(run_files["pdf"])},
        **other,
    )

    assert response.status_code == 404


def test_the_cli_publishes_a_scored_run(client, api_key, benchmark_case, run_files):
    submission = _create(client, api_key, origin="cli").json()["id"]

    response = client.post(
        f"{BASE}/submissions/{submission}/runs",
        {
            "manifest": _json(run_files["manifest"], "manifest.json"),
            "report": _json(run_files["report"], "report.json"),
            "pdf": _pdf(run_files["pdf"]),
            "overlay": SimpleUploadedFile("o.png", run_files["overlay"], "image/png"),
        },
        **api_key,
    )

    assert response.status_code == 201, response.content
    body = response.json()
    assert body["run_id"] == run_files["manifest"]["run_id"]
    assert body["verification"] == "pending"
    assert body["counts"]["FN"] == 12
    assert body["overlay"]["url"].endswith("overlay.png")


def test_a_report_that_is_not_json_is_a_422(client, api_key, benchmark_case, run_files):
    submission = _create(client, api_key, origin="cli").json()["id"]

    response = client.post(
        f"{BASE}/submissions/{submission}/runs",
        {
            "manifest": _json(run_files["manifest"], "manifest.json"),
            "report": SimpleUploadedFile("report.json", b"{not json"),
            "pdf": _pdf(run_files["pdf"]),
        },
        **api_key,
    )

    assert response.status_code == 422
    assert "report.json" in response.json()["detail"]


# --- sending it, and afterwards ------------------------------------------------------


def test_finalizing_scores_it_and_the_submitter_follows_it(client, bearer, draft, run_files):
    client.post(
        f"{BASE}/submissions/{draft}/outputs",
        {"case_id": "extraction-conditions-1", "pdf": _pdf(run_files["pdf"])},
        **bearer,
    )

    sent = client.post(f"{BASE}/submissions/{draft}/finalize", **bearer)

    assert sent.status_code == 200
    assert sent.json()["status"] == "pending_review"
    [mine] = client.get(f"{BASE}/submissions/mine", **bearer).json()
    assert mine["id"] == draft
    assert mine["runs"][0]["status"] == "scored"
    assert client.get(f"{BASE}/submissions/{draft}", **bearer).json()["status"] == (
        "pending_review"
    )


def test_a_submission_is_withdrawn_with_a_delete(client, bearer, draft):
    response = client.delete(f"{BASE}/submissions/{draft}", **bearer)

    assert response.status_code == 200
    assert Submission.objects.get(pk=draft).status == SubmissionStatus.WITHDRAWN


# --- cases, from the CLI -----------------------------------------------------------------


def test_staff_publish_a_case_from_the_cli(client, staff_api_key, case_files):
    pdf, truth = case_files

    response = client.post(
        f"{BASE}/suites/pdf/cases",
        {
            "pdf": _pdf(pdf, "extraction-conditions-1.pdf"),
            "ground_truth": _json(truth, "ground_truth.json"),
            "visibility": "public",
        },
        **staff_api_key,
    )

    assert response.status_code == 201, response.content
    assert response.json()["case_id"] == "extraction-conditions-1"
    assert "ground_truth" not in response.json()
    assert Case.objects.get().ground_truth["seed"] == truth["seed"]


def test_nobody_else_publishes_a_case(client, api_key, case_files):
    pdf, truth = case_files

    response = client.post(
        f"{BASE}/suites/pdf/cases",
        {"pdf": _pdf(pdf), "ground_truth": _json(truth, "ground_truth.json")},
        **api_key,
    )

    assert response.status_code == 403
