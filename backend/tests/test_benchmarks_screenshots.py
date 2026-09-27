"""Screenshots a run was made with: the tool's settings, its warnings, its result screen.

They are evidence, not score - so they ride along with a run from the CLI, and can be
added to a run after it is published, without reopening the submission.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.benchmarks import services
from apps.benchmarks.models import (
    RunStatus,
    ScreenshotStatus,
    SubmissionOrigin,
    SubmissionStatus,
)
from apps.benchmarks.services import BenchmarkError

pytestmark = pytest.mark.django_db

BASE = "/api/v1/benchmarks"


def _png(width=640, height=400, color=(20, 120, 200)):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _submission(account):
    return services.open_submission(
        user=account, suite="pdf", tool="pdf-redaction", surface="web", origin=SubmissionOrigin.CLI
    )


def _run(account, run_files, screenshots=()):
    return services.add_scored_run(
        user=account,
        submission=_submission(account),
        manifest=run_files["manifest"],
        report=run_files["report"],
        overlay=run_files["overlay"],
        pdf=run_files["pdf"],
        screenshots=screenshots,
    )


def _approve(run, staff_user):
    run.status = RunStatus.SCORED
    run.save(update_fields=["status"])
    submission = run.submission
    submission.status = SubmissionStatus.PENDING_REVIEW
    submission.save(update_fields=["status"])
    services.review(user=staff_user, submission=submission, status=SubmissionStatus.APPROVED)
    return run


# --- the service ---------------------------------------------------------------------


def test_a_cli_run_keeps_its_screenshots_in_order(user, benchmark_case, run_files):
    run = _run(user, run_files, screenshots=[_png(color=(1, 2, 3)), _png(color=(4, 5, 6))])

    shots = list(run.screenshots.all())
    assert [s.position for s in shots] == [0, 1]
    assert all(s.image.name.endswith("screenshot.png") for s in shots)
    assert shots[0].widths == [480]
    assert (shots[0].width, shots[0].height) == (640, 400)
    # Sent with the submission, so reviewed with it.
    assert {s.status for s in shots} == {ScreenshotStatus.PUBLISHED}


def test_screenshots_are_added_to_a_published_run(user, staff_user, benchmark_case, run_files):
    run = _approve(_run(user, run_files), staff_user)

    added = services.add_screenshots(user=staff_user, run=run, images=[_png()])

    assert len(added) == 1
    assert added[0].status == ScreenshotStatus.PUBLISHED


def test_a_non_staff_screenshot_on_a_published_run_waits_for_an_editor(
    user, staff_user, benchmark_case, run_files
):
    run = _approve(_run(user, run_files), staff_user)

    added = services.add_screenshots(user=user, run=run, images=[_png()])

    # The review that published the run never saw it.
    assert added[0].status == ScreenshotStatus.PENDING


def test_sending_the_same_screenshot_again_adds_nothing(user, benchmark_case, run_files):
    run = _run(user, run_files, screenshots=[_png()])

    assert services.add_screenshots(user=user, run=run, images=[_png()]) == []
    assert run.screenshots.count() == 1


def test_a_new_screenshot_goes_after_the_ones_already_there(user, benchmark_case, run_files):
    run = _run(user, run_files, screenshots=[_png()])

    (added,) = services.add_screenshots(user=user, run=run, images=[_png(color=(9, 9, 9))])

    assert added.position == 1


def test_nobody_adds_screenshots_to_someone_elses_run(user, owner, benchmark_case, run_files):
    run = _run(user, run_files)

    with pytest.raises(BenchmarkError, match="not yours"):
        services.add_screenshots(user=owner, run=run, images=[_png()])


def test_a_withdrawn_run_takes_no_screenshots(user, benchmark_case, run_files):
    run = _run(user, run_files)
    services.withdraw(user=user, submission=run.submission)

    with pytest.raises(BenchmarkError, match="withdrawn"):
        services.add_screenshots(user=user, run=run, images=[_png()])


def test_a_run_holds_a_limited_number_of_screenshots(user, benchmark_case, run_files, settings):
    settings.BENCHMARK_MAX_SCREENSHOTS_PER_RUN = 2
    run = _run(user, run_files, screenshots=[_png(color=(1, 1, 1))])

    with pytest.raises(BenchmarkError, match="2 screenshots"):
        services.add_screenshots(
            user=user, run=run, images=[_png(color=(2, 2, 2)), _png(color=(3, 3, 3))]
        )
    assert run.screenshots.count() == 1


def test_a_file_that_is_not_an_image_is_refused_by_position(user, benchmark_case, run_files):
    run = _run(user, run_files)

    with pytest.raises(BenchmarkError, match="Screenshot 2"):
        services.add_screenshots(user=user, run=run, images=[_png(), b"not an image"])
    # All or nothing: a half-added batch would be retried into duplicates.
    assert run.screenshots.count() == 0


# --- the API -------------------------------------------------------------------------


def _shot(data, name="Screenshot 2026-09-25 at 10.11.52.png"):
    return SimpleUploadedFile(name, data, content_type="image/png")


def test_the_cli_sends_screenshots_with_a_run(client, api_key, benchmark_case, run_files):
    import json

    submission = client.post(
        f"{BASE}/suites/pdf/submissions",
        {"tool": "pdf-redaction", "surface": "web", "origin": "cli"},
        content_type="application/json",
        **api_key,
    ).json()["id"]

    response = client.post(
        f"{BASE}/submissions/{submission}/runs",
        {
            "manifest": SimpleUploadedFile(
                "manifest.json", json.dumps(run_files["manifest"]).encode()
            ),
            "report": SimpleUploadedFile("report.json", json.dumps(run_files["report"]).encode()),
            "pdf": SimpleUploadedFile("r.pdf", run_files["pdf"], "application/pdf"),
            "screenshots": [_shot(_png(color=(1, 1, 1))), _shot(_png(color=(2, 2, 2)))],
        },
        **api_key,
    )

    assert response.status_code == 201, response.content
    shots = response.json()["screenshots"]
    assert len(shots) == 2
    assert shots[0]["status"] == "published"
    assert shots[0]["url"].endswith("screenshot.png")


def test_the_cli_adds_screenshots_to_a_published_run(
    client, staff_api_key, staff_user, user, benchmark_case, run_files
):
    run = _approve(_run(user, run_files), staff_user)

    response = client.post(
        f"{BASE}/runs/{run.run_id}/screenshots",
        {"screenshots": [_shot(_png())]},
        **staff_api_key,
    )

    assert response.status_code == 201, response.content
    assert [s["status"] for s in response.json()["screenshots"]] == ["published"]


def test_adding_to_a_run_that_is_not_yours_is_a_404(client, user, owner, benchmark_case, run_files):
    from apps.accounts import jwt

    run = _run(user, run_files)
    other = {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(owner)}"}}

    response = client.post(
        f"{BASE}/runs/{run.run_id}/screenshots", {"screenshots": [_shot(_png())]}, **other
    )

    assert response.status_code == 404


def test_a_published_run_shows_only_published_screenshots(
    client, user, staff_user, benchmark_case, run_files
):
    run = _approve(_run(user, run_files, screenshots=[_png(color=(1, 1, 1))]), staff_user)
    services.add_screenshots(user=user, run=run, images=[_png(color=(2, 2, 2))])

    body = client.get(f"{BASE}/runs/{run.run_id}").json()

    assert len(body["screenshots"]) == 1
    shot = body["screenshots"][0]
    assert shot["url"].endswith("screenshot.png")
    assert shot["srcset"].endswith("480w")
    assert (shot["width"], shot["height"]) == (640, 400)


def test_a_case_page_carries_each_runs_screenshots(
    client, user, staff_user, benchmark_case, run_files
):
    _approve(_run(user, run_files, screenshots=[_png()]), staff_user)

    body = client.get(f"{BASE}/suites/pdf/cases/{benchmark_case.case_id}").json()

    assert len(body["runs"][0]["screenshots"]) == 1


def test_an_editor_publishes_a_pending_screenshot(user, staff_user, benchmark_case, run_files):
    run = _approve(_run(user, run_files), staff_user)
    (shot,) = services.add_screenshots(user=user, run=run, images=[_png()])

    services.publish_screenshots(user=staff_user, screenshots=[shot])

    shot.refresh_from_db()
    assert shot.status == ScreenshotStatus.PUBLISHED


def test_only_an_editor_publishes_one(user, staff_user, benchmark_case, run_files):
    run = _approve(_run(user, run_files), staff_user)
    (shot,) = services.add_screenshots(user=user, run=run, images=[_png()])

    with pytest.raises(BenchmarkError, match="staff"):
        services.publish_screenshots(user=user, screenshots=[shot])
