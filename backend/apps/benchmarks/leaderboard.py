"""One leaderboard row per tool and surface, pooled from approved runs.

Pooling follows pdfredeval's own rules, because a leaderboard that broke them would
publish numbers the CLI never would:
- counts are pooled and every rate recomputed from the pooled counts - rates are never
  averaged, so a 2-probe case cannot weigh as much as a 90-probe one;
- one case contributes its latest approved run, so a re-test replaces a result rather
  than doubling it;
- runs scored under a different threshold table are a different measurement: a row pools
  only the thresholds its newest run used, and says how many runs that left out.

Weighted leak rate is per run and is not pooled here - it needs every probe's weight,
which a run's headline does not carry. The tool report shows it case by case.
"""

from collections import defaultdict

from apps.benchmarks.models import Run, ScoredBy, SubmissionStatus, Verification

SCOPES = ("all", "verified")

# Worst first: a row is described by its least trustworthy run.
PROVENANCE_ORDER = ("mismatch", "unverified", "verified", "server")


def tool_ref(tool):
    """What a row says about its tool. `listable` decides whether the site links it:
    a tool that fails the catalog's public gate is a row, not a page."""
    return {
        "slug": tool.slug,
        "name": tool.name,
        "logo_url": tool.logo_url,
        "listable": tool.is_listable(),
    }


def provenance(run):
    """How far a run's numbers can be trusted, as the site badges it."""
    if run.scored_by == ScoredBy.SERVER:
        return "server"
    if run.verification == Verification.VERIFIED:
        return "verified"
    if run.verification == Verification.MISMATCH:
        return "mismatch"
    return "unverified"


def approved_runs(revision, *, scope="all"):
    """Every approved run in `revision`, oldest decision first."""
    runs = (
        Run.objects.filter(
            submission__revision=revision,
            submission__status=SubmissionStatus.APPROVED,
            status="scored",
        )
        .select_related("submission__tool__vendor", "case")
        .order_by("submission__reviewed_at", "created_at", "pk")
    )
    if scope == "verified":
        runs = [run for run in runs if provenance(run) in ("server", "verified")]
    return list(runs)


def latest_per_case(runs):
    """The newest run of each case, from runs in decision order."""
    latest = {}
    for run in runs:
        latest[run.case_id] = run
    return list(latest.values())


def latest_per_tool_and_case(runs, *, case_id):
    """The newest run of one case for each tool and surface: what a case page lists."""
    latest = {}
    for run in runs:
        if run.case_id == case_id:
            latest[(run.submission.tool_id, run.submission.surface)] = run
    return sorted(latest.values(), key=lambda run: (run.fn / max(run.tp + run.fn, 1), run.pk))


def pool(runs):
    """The pooled summary of `runs`: what one leaderboard row, or one tool report, says."""
    from pdfredeval.score.metrics import rate

    tp = sum(run.tp for run in runs)
    fn = sum(run.fn for run in runs)
    fp = sum(run.fp for run in runs)
    tn = sum(run.tn for run in runs)
    retention = [run.text_retention for run in runs if run.text_retention is not None]
    return {
        "leak_rate": rate(fn, tp + fn).to_dict(),
        "over_redaction_rate": rate(fp, fp + tn).to_dict(),
        "counts": {
            "TP": tp,
            "FN": fn,
            "FP": fp,
            "TN": tn,
            "unsupported": sum(run.unsupported for run in runs),
            "undecided": sum(run.undecided for run in runs),
        },
        "cases": len(runs),
        "gates_failed": sum(1 for run in runs if run.gates_passed is False),
        "lowest_text_retention": min(retention) if retention else None,
        "provenance": min(
            (provenance(run) for run in runs), key=PROVENANCE_ORDER.index, default="server"
        ),
    }


def select(runs):
    """`(poolable runs, runs excluded)` for one tool and surface.

    Latest run per case, then only those scored under the threshold table the newest of
    them used.
    """
    latest = latest_per_case(runs)
    if not latest:
        return [], 0
    newest = max(latest, key=lambda run: (run.submission.reviewed_at, run.created_at, run.pk))
    kept = [run for run in latest if run.thresholds_digest == newest.thresholds_digest]
    return kept, len(latest) - len(kept)


def build(revision, *, scope="all"):
    """The leaderboard for `revision`, best first."""
    groups = defaultdict(list)
    for run in approved_runs(revision, scope=scope):
        groups[(run.submission.tool_id, run.submission.surface)].append(run)

    rows = []
    for runs in groups.values():
        kept, excluded = select(runs)
        if not kept:
            continue
        tool = kept[0].submission.tool
        submitters = sorted(
            {(run.submission.submitter_name, run.submission.submitter_role) for run in kept}
        )
        rows.append(
            {
                "tool": tool_ref(tool),
                "surface": kept[0].submission.surface,
                **pool(kept),
                "runs_excluded": excluded,
                "submitters": [{"name": name, "role": role} for name, role in submitters],
                "last_reviewed_at": max(run.submission.reviewed_at for run in kept),
            }
        )
    rows.sort(key=_rank)
    return rows


def _rank(row):
    """Leak rate, then over-redaction; an undefined rate sorts after every defined one."""

    def value(rate):
        return (rate["value"] is None, rate["value"] or 0.0)

    return (*value(row["leak_rate"]), *value(row["over_redaction_rate"]), row["tool"]["name"])


# Report sections that are `{key: {leak_rate: Rate, over_redaction_rate: Rate, n}}`.
GROUPED_SECTIONS = ("by_category", "by_severity", "by_difficulty", "by_kind", "by_trap")


def pool_breakdowns(reports):
    """The breakdown tables of a tool report, pooled across its runs' report.json.

    Same rule as the headline: every rate's count and n are summed and the rate
    recomputed. A key missing from one report simply contributes nothing there.
    """
    grouped = {
        section: defaultdict(lambda: defaultdict(lambda: [0, 0])) for section in GROUPED_SECTIONS
    }
    reach = defaultdict(lambda: [0, 0])
    layers = {}
    gates = defaultdict(lambda: {"failed": 0, "runs": 0})

    for report in reports:
        for section in GROUPED_SECTIONS:
            for key, entry in (report.get(section) or {}).items():
                # pandas writes a missing trap as "nan": it means "no trap", not a trap.
                if key == "nan":
                    continue
                for name in ("leak_rate", "over_redaction_rate"):
                    _add(grouped[section][key][name], entry.get(name))
        for channel, entry in (report.get("reach") or {}).items():
            _add(reach[channel], entry)
        for layer, entry in (report.get("layers") or {}).items():
            pooled = layers.setdefault(
                layer,
                {
                    "layer_leak_rate": [0, 0],
                    "exclusive_leak_rate": [0, 0],
                    "unavailable": 0,
                    "severity": entry.get("severity", ""),
                    "if_it_survives": entry.get("if_it_survives", ""),
                },
            )
            _add(pooled["layer_leak_rate"], entry.get("layer_leak_rate"))
            _add(pooled["exclusive_leak_rate"], entry.get("exclusive_leak_rate"))
            pooled["unavailable"] += entry.get("unavailable") or 0
        for gate in (report.get("survivability") or {}).get("gates") or []:
            gates[gate["gate"]]["runs"] += 1
            gates[gate["gate"]]["failed"] += 0 if gate.get("passed") else 1

    return {
        **{
            section: {
                key: {name: _rate(pair) for name, pair in rates.items()}
                for key, rates in sorted(entries.items())
            }
            for section, entries in grouped.items()
        },
        "reach": {channel: _rate(pair) for channel, pair in sorted(reach.items())},
        "layers": {
            layer: {
                **entry,
                "layer_leak_rate": _rate(entry["layer_leak_rate"]),
                "exclusive_leak_rate": _rate(entry["exclusive_leak_rate"]),
            }
            for layer, entry in layers.items()
        },
        "gates": dict(gates),
    }


def _add(pair, rate):
    if rate:
        pair[0] += rate.get("count") or 0
        pair[1] += rate.get("n") or 0


def _rate(pair):
    from pdfredeval.score.metrics import rate

    return rate(*pair).to_dict()
