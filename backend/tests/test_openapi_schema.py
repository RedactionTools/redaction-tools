"""The OpenAPI document is the frontend's source of truth, so guard its shape.

Operation ids become TypeScript hook names in `frontend/src/lib/api/generated`,
which is why they are asserted here rather than left to ninja's default.
"""

from config.api import api


def test_operation_ids_are_view_names():
    schema = api.get_openapi_schema()

    assert schema["paths"]["/api/v1/health"]["get"]["operationId"] == "health"
    assert schema["paths"]["/api/v1/auth/me"]["get"]["operationId"] == "get_me"


def test_operation_ids_are_unique():
    """A collision would silently generate a wrong hook name, so fail loudly here."""
    schema = api.get_openapi_schema()

    ids = [op["operationId"] for path in schema["paths"].values() for op in path.values()]

    assert len(ids) == len(set(ids)), sorted(ids)
