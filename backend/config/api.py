"""The public API surface.

Endpoints are open by default; protect one by passing `auth=JWTAuth()` (a user
bearer token) or `auth=APIKeyAuth()` from `ninja_apikey.security` (a service key).
"""

from ninja import NinjaAPI
from ninja.operation import Operation

from apps.accounts.api import router as accounts_router
from apps.benchmarks.api import router as benchmarks_router
from apps.catalog.api import router as catalog_router
from apps.core.api import router as core_router


class RedactionAPI(NinjaAPI):
    """A NinjaAPI whose operation ids are just the view function names.

    Ninja's default is the dotted module path (`apps_core_api_health`), which
    Orval turns into hook names like `useAppsCoreApiHealth`. The bare view name
    gives `useHealth` / `useGetMe` instead. View names must therefore be unique
    across the whole API - `tests/test_openapi_schema.py` enforces that. Pass
    `operation_id=` on a route to opt out.
    """

    def get_openapi_operation_id(self, operation: Operation) -> str:
        return operation.view_func.__name__


api = RedactionAPI(
    title="redaction-tools API",
    version="1.0.0",
    description=(
        "Redaction tools compared by price, media and method, with the source and date "
        "recorded for every figure."
    ),
    urls_namespace="api",
    docs_url="/docs",
)

api.add_router("/", core_router)
api.add_router("/auth/", accounts_router)
api.add_router("/catalog/", catalog_router)
api.add_router("/benchmarks/", benchmarks_router)
