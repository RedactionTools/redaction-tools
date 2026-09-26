"""The staff HTTP surface: what the tool page's inline editors write through.

Every route is a thin wrapper over `apps.catalog.staff`, the module the MCP
server also calls, so the rules - allowlists, URL checks, the revision trail,
the slot-scoped price close - live in one place. Nothing here writes to the ORM.
"""

from django.http import HttpRequest
from ninja import File, Form, Router, Status
from ninja.files import UploadedFile

from apps.accounts.api import StaffJWTAuth
from apps.catalog import images, staff
from apps.catalog.schemas import (
    ScreenshotUploadIn,
    StaffChangesIn,
    StaffPlanCreateIn,
    StaffPlanCreateOut,
    StaffPlanLimitIn,
    StaffPlanLimitOut,
    StaffPlanPriceIn,
    StaffPlanPriceOut,
    StaffPlanUpdateOut,
    StaffScreenshotOut,
    StaffScreenshotReviewIn,
    StaffToolFacetIn,
    StaffToolFacetOut,
    StaffToolFacetRemovedOut,
    StaffToolLogoOut,
    StaffToolOut,
    StaffToolUpdateOut,
)

router = Router(tags=["catalog-staff"], auth=StaffJWTAuth())


@router.get("/tools/{slug}", response=StaffToolOut, summary="A listing's whole editable record")
def staff_get_tool(request: HttpRequest, slug: str):
    return staff.tool_detail(slug)


@router.patch("/tools/{slug}", response=StaffToolUpdateOut, summary="Edit a listing's fields")
def staff_update_tool(request: HttpRequest, slug: str, payload: StaffChangesIn):
    return staff.update_tool(user=request.auth, slug=slug, changes=payload.changes)


# --- Plans -------------------------------------------------------------------
# One route per table, as on the MCP server: a plan, its caps and each of its
# prices are separate writes, so none of them can half-succeed.


@router.post("/tools/{slug}/plans", response={201: StaffPlanCreateOut}, summary="Add a plan")
def staff_create_plan(request: HttpRequest, slug: str, payload: StaffPlanCreateIn):
    return Status(
        201,
        staff.create_plan(
            user=request.auth,
            slug=slug,
            code=payload.code,
            name=payload.name,
            changes=payload.changes,
        ),
    )


@router.patch(
    "/tools/{slug}/plans/{code}", response=StaffPlanUpdateOut, summary="Edit a plan's fields"
)
def staff_update_plan(request: HttpRequest, slug: str, code: str, payload: StaffChangesIn):
    return staff.update_plan(user=request.auth, slug=slug, code=code, changes=payload.changes)


@router.put(
    "/tools/{slug}/plans/{code}/limits/{kind}",
    response=StaffPlanLimitOut,
    summary="Set a plan's cap of one kind",
)
def staff_set_plan_limit(
    request: HttpRequest, slug: str, code: str, kind: str, payload: StaffPlanLimitIn
):
    return staff.set_plan_limit(
        user=request.auth, slug=slug, code=code, kind=kind, **payload.dict()
    )


@router.post(
    "/tools/{slug}/plans/{code}/prices",
    response={201: StaffPlanPriceOut},
    summary="Publish a plan's price, replacing the figure in the same slot",
)
def staff_set_plan_price(request: HttpRequest, slug: str, code: str, payload: StaffPlanPriceIn):
    return Status(
        201, staff.set_plan_price(user=request.auth, slug=slug, code=code, **payload.dict())
    )


# --- Facets ------------------------------------------------------------------


@router.post(
    "/tools/{slug}/facets", response={201: StaffToolFacetOut}, summary="Put a facet on a listing"
)
def staff_add_tool_facet(request: HttpRequest, slug: str, payload: StaffToolFacetIn):
    return Status(201, staff.add_tool_facet(user=request.auth, slug=slug, **payload.dict()))


@router.delete(
    "/tools/{slug}/facets/{dimension}/{value}",
    response=StaffToolFacetRemovedOut,
    summary="Take a facet off a listing",
)
def staff_remove_tool_facet(request: HttpRequest, slug: str, dimension: str, value: str):
    return staff.remove_tool_facet(user=request.auth, slug=slug, dimension=dimension, value=value)


# --- Media -------------------------------------------------------------------
# Files, not URLs: an editor on the page holds the picture already. Stored
# through the same services as the MCP's fetched ones, so the renditions,
# digests and SVG refusal are identical.


def _read_upload(image):
    # Django streams a large upload to disk without complaint, so the ceiling is
    # checked before the file is read into memory to be decoded.
    if image.size > images.MAX_UPLOAD_BYTES:
        limit = images.MAX_UPLOAD_BYTES // 1024 // 1024
        raise staff.StaffError(f"That file is too large. The limit is {limit} MB.")
    return image.read()


@router.post(
    "/tools/{slug}/screenshots",
    response={201: StaffScreenshotOut},
    summary="Upload a screenshot, published on arrival",
)
def staff_upload_screenshot(
    request: HttpRequest,
    slug: str,
    payload: Form[ScreenshotUploadIn],
    image: File[UploadedFile],
):
    return Status(
        201,
        staff.upload_screenshot(
            user=request.auth, slug=slug, data=_read_upload(image), **payload.dict()
        ),
    )


@router.get(
    "/tools/{slug}/screenshots",
    response=list[StaffScreenshotOut],
    summary="Every screenshot on a listing, at any status",
)
def staff_list_screenshots(request: HttpRequest, slug: str):
    return staff.list_screenshots(slug=slug)["items"]


@router.post(
    "/screenshots/{screenshot_id}/review",
    response=StaffScreenshotOut,
    summary="Publish or reject a screenshot",
)
def staff_review_screenshot(
    request: HttpRequest, screenshot_id: int, payload: StaffScreenshotReviewIn
):
    return staff.review_screenshot(
        user=request.auth, screenshot_id=screenshot_id, status=payload.status, note=payload.note
    )


@router.post("/tools/{slug}/logo", response=StaffToolLogoOut, summary="Upload a listing's logo")
def staff_upload_tool_logo(request: HttpRequest, slug: str, image: File[UploadedFile]):
    return staff.upload_tool_logo(user=request.auth, slug=slug, data=_read_upload(image))
