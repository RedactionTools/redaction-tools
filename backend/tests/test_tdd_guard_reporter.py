"""The reporter has to write where the hook reads.

Not a test of tdd-guard, which is not ours. A test of the one line of wiring
between them, because its failure mode is silent in the worst direction: the
guard sees no test output, concludes nothing has been proven, and refuses every
implementation edit - so the discipline it exists to enforce cannot be followed
at all. Nothing else in the suite would go red if this drifted.
"""

import pathlib

from tdd_guard_pytest.pytest_reporter import TDDGuardPytestPlugin

# Derived here independently of conftest's own answer, so this fails if that
# derivation breaks rather than agreeing with it by construction.
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


def test_the_reporter_writes_where_the_hook_reads(pytestconfig):
    """`pytestconfig` is the live config, so this exercises the real resolution
    - the ini option set in conftest included - rather than a reconstruction."""
    plugin = TDDGuardPytestPlugin(pytestconfig)

    assert plugin.storage_dir == REPO_ROOT / ".claude" / "tdd-guard" / "data"
    assert (REPO_ROOT / ".claude" / "tdd-guard" / "data" / "instructions.md").is_file()
