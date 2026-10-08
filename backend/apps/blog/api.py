"""Guest post submissions. Blog posts themselves are MDX in the frontend, so a
submission is a queue row for staff to read, never a page."""

from django.http import HttpRequest
from ninja import Router, Status

from apps.accounts.api import JWTAuth
from apps.blog import services
from apps.blog.schemas import PostSubmissionIn, PostSubmissionOut
from apps.blog.throttles import PostSubmissionThrottle
from apps.catalog.services import client_ip

router = Router(tags=["blog"])


@router.post(
    "/submissions",
    response={201: PostSubmissionOut},
    auth=JWTAuth(),
    throttle=[PostSubmissionThrottle()],
    summary="Submit a blog post for review",
)
def create_post_submission(request: HttpRequest, payload: PostSubmissionIn):
    submission = services.submit_post(
        user=request.auth,
        data=payload.dict(),
        source_ip=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )
    return Status(201, submission)


@router.get(
    "/submissions",
    response=list[PostSubmissionOut],
    auth=JWTAuth(),
    summary="Blog posts you have submitted",
)
def list_my_post_submissions(request: HttpRequest):
    return request.auth.post_submissions.all()
