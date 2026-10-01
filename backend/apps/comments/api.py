"""The public comment API: anyone reads, a signed-in reader writes.

Every route is a thin wrapper over `apps.comments.services`. A refusal is a
`CommentError`, which `config/api.py` turns into a 422 `detail`; a missing page
or a comment that is not the caller's is a 404.
"""

import contextlib

from django.http import HttpRequest
from ninja import Router, Status
from ninja.errors import HttpError

from apps.accounts.api import JWTAuth
from apps.comments import services
from apps.comments.schemas import CommentEditIn, CommentIn, CommentOut
from apps.comments.throttles import CommentThrottle
from apps.core.schemas import ErrorSchema

router = Router(tags=["comments"])


@contextlib.contextmanager
def _not_found():
    try:
        yield
    except services.CommentNotFound as exc:
        raise HttpError(404, str(exc)) from exc


@router.get(
    "/tool/{slug}",
    response={200: list[CommentOut], 404: ErrorSchema},
    summary="Published comments on a tool page",
)
def list_tool_comments(request: HttpRequest, slug: str):
    with _not_found():
        return services.public_thread(target_type="tool", slug=slug)


@router.get(
    "/blog/{slug}",
    response={200: list[CommentOut]},
    summary="Published comments on a blog post",
)
def list_blog_comments(request: HttpRequest, slug: str):
    return services.public_thread(target_type="blog", slug=slug)


@router.get(
    "/mine",
    response={200: list[CommentOut], 404: ErrorSchema},
    auth=JWTAuth(),
    summary="Your comments on a page that are awaiting review",
)
def list_my_pending_comments(request: HttpRequest, target_type: str, slug: str):
    with _not_found():
        return services.my_pending(user=request.auth, target_type=target_type, slug=slug)


@router.post(
    "/",
    response={201: CommentOut, 404: ErrorSchema},
    auth=JWTAuth(),
    throttle=[CommentThrottle()],
    summary="Post a comment or a reply",
)
def create_comment(request: HttpRequest, payload: CommentIn):
    with _not_found():
        comment = services.post_comment(
            user=request.auth,
            target_type=payload.target_type,
            slug=payload.slug,
            body=payload.body,
            parent_id=payload.parent_id,
        )
    return Status(201, services.serialize(comment))


@router.patch(
    "/{comment_id}",
    response={200: CommentOut, 404: ErrorSchema},
    auth=JWTAuth(),
    summary="Edit your comment",
)
def update_comment(request: HttpRequest, comment_id: int, payload: CommentEditIn):
    with _not_found():
        comment = services.edit_comment(user=request.auth, comment_id=comment_id, body=payload.body)
    return services.serialize(comment)


@router.delete(
    "/{comment_id}",
    response={204: None, 404: ErrorSchema},
    auth=JWTAuth(),
    summary="Delete your comment",
)
def delete_comment(request: HttpRequest, comment_id: int):
    with _not_found():
        services.delete_own_comment(user=request.auth, comment_id=comment_id)
    return Status(204, None)
