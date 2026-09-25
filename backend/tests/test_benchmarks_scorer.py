"""The vendored pdfredeval scorer, driven the way the backend drives it.

The fixtures are one real case and one real scored run copied out of
pdf-redaction-benchmarks (`benchmarks/v0.1.1`), so these tests pin the backend to the
numbers the CLI itself published - a submodule bump that changes a score shows up here.
"""

import json
import pathlib

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "benchmarks"


def test_the_vendored_scorer_reproduces_the_cli_counts():
    from pdfredeval.manifest import RunManifest
    from pdfredeval.score.scorer import score
    from pdfredeval.types import Case

    case = Case.from_dir(FIXTURES / "case")
    manifest = RunManifest.load(FIXTURES / "run" / "manifest.json")
    output = (FIXTURES / "run" / "redacted-extraction-conditions-1.pdf").read_bytes()

    result = score(case, output, manifest=manifest)

    claimed = json.loads((FIXTURES / "run" / "report.json").read_text())
    assert result.summary()["counts"] == claimed["summary"]["counts"]
