"""Per-account limits on the benchmark writes.

Keyed on `str(request.auth)`, which is the account whether it arrived with an API key
or a bearer token - so a CLI and a browser share one allowance.
"""

from django.conf import settings
from ninja.throttling import AuthRateThrottle


class BenchmarkWriteThrottle(AuthRateThrottle):
    """Generous by the standard of the catalog's limits: one case set is dozens of writes,
    and each PDF is scored in the worker rather than in the request."""

    scope = "benchmark_write"

    def __init__(self):
        super().__init__(settings.BENCHMARK_SUBMIT_RATE)
