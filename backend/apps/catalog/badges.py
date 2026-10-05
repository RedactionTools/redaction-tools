"""What a tool's embeddable badges may claim.

The badge SVG is drawn by the frontend, on the owner's own site, for as long as
they keep the snippet. So the claim is decided here, on every request, and a badge
whose claim no longer holds goes grey rather than staying true by accident.
"""

from apps.benchmarks import leaderboard


def badge_states(tool):
    listed = tool.is_listable()
    suites = (
        [{"suite": suite.slug, "name": suite.name} for suite in leaderboard.suites_for_tool(tool)]
        if listed
        else []
    )
    return {
        "listed": listed,
        "reviewed": listed and tool.editorial_reviewed_at is not None,
        "benchmarked": bool(suites),
        "benchmark_suites": suites,
    }
