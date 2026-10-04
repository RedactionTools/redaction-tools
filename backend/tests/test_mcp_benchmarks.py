"""The staff benchmark tools, over JSON-RPC.

The rules are tested in `test_benchmarks_staff.py`; this file proves the wiring.
"""

import copy
import json

import pytest

from apps.benchmarks import services
from apps.benchmarks.models import SubmissionStatus

pytestmark = pytest.mark.django_db

TOOLS = {
    "benchmarks_list_suites",
    "benchmarks_get_leaderboard",
    "benchmarks_list_submissions",
    "benchmarks_get_submission",
    "benchmarks_review_submission",
    "benchmarks_list_screenshots",
    "benchmarks_publish_screenshots",
}


def payload(result):
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


@pytest.fixture
def pending(user, benchmark_case, run_files):
    flattering = copy.deepcopy(run_files["report"])
    flattering["summary"]["counts"].update({"TP": 54, "FN": 0})
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="cli"
    )
    services.add_scored_run(
        user=user,
        submission=submission,
        manifest=run_files["manifest"],
        report=flattering,
        overlay=run_files["overlay"],
        pdf=run_files["pdf"],
    )
    return services.finalize(user=user, submission=submission)


def test_the_server_offers_the_benchmark_tools(mcp):
    names = {tool["name"] for tool in mcp("tools/list").json()["result"]["tools"]}

    assert {name for name in names if name.startswith("benchmarks_")} == TOOLS


def test_reading_the_queue_and_a_submission(call_tool, pending):
    queue = payload(call_tool("benchmarks_list_submissions", {"status": "pending_review"}))
    detail = payload(
        call_tool("benchmarks_get_submission", {"submission_id": queue["items"][0]["id"]})
    )

    assert detail["runs"][0]["verification"] == "mismatch"


def test_approving_from_the_mcp(call_tool, pending, staff_user):
    body = payload(
        call_tool(
            "benchmarks_review_submission",
            {"submission_id": str(pending.pk), "status": "approved"},
        )
    )

    pending.refresh_from_db()
    assert (body["status"], pending.status, pending.reviewed_by) == (
        "approved",
        SubmissionStatus.APPROVED,
        staff_user,
    )


def test_a_refused_review_comes_back_as_an_error_the_model_can_fix(call_tool, pending):
    result = call_tool(
        "benchmarks_review_submission", {"submission_id": str(pending.pk), "status": "rejected"}
    )

    assert result["isError"] is True
    assert "Say why" in result["content"][0]["text"]


def test_the_leaderboard_and_suites_read(call_tool, benchmark_case):
    suites = payload(call_tool("benchmarks_list_suites"))
    board = payload(call_tool("benchmarks_get_leaderboard", {"suite": "pdf"}))

    assert "pdf" in {suite["slug"] for suite in suites["suites"]}
    assert (board["revision"], board["rows"]) == ("v0.1.1", [])


def test_an_approved_result_reaches_the_leaderboard(call_tool, pending):
    from apps.benchmarks.models import RunStatus

    pending.runs.update(status=RunStatus.SCORED)
    payload(
        call_tool(
            "benchmarks_review_submission",
            {"submission_id": str(pending.pk), "status": "approved"},
        )
    )

    (row,) = payload(call_tool("benchmarks_get_leaderboard", {"suite": "pdf"}))["rows"]

    assert (row["tool"]["slug"], row["provenance"]) == ("pdf-redaction", "mismatch")
