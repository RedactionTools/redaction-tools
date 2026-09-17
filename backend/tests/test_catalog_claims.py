"""Claiming a listing.

A claim proves someone can receive mail at the vendor's domain. It never proves
who they are, which is why every claim still passes through staff review.
"""

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone

from apps.catalog.claims import domain_matches
from apps.catalog.models import Tool, ToolClaim, ToolClaimCode, ToolClaimStatus

URL = "/api/v1/catalog/claims"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def claim(db, user):
    tool = Tool.objects.get(slug="adobe-acrobat")
    return ToolClaim.objects.create(
        tool=tool, user=user, work_email="rep@adobe.com", email_domain="adobe.com"
    )


class TestDomainMatching:
    def test_a_work_address_on_the_vendor_domain_matches(self):
        assert domain_matches("rep@adobe.com", "https://www.adobe.com/acrobat.html") is True

    def test_a_subdomain_site_still_matches_the_parent_domain(self):
        assert domain_matches("rep@adobe.com", "https://products.adobe.com/") is True

    def test_a_freemail_address_never_matches(self):
        """Anyone can hold a gmail address; it proves nothing about employment."""
        assert domain_matches("someone@gmail.com", "https://gmail.com/") is False

    def test_an_unrelated_domain_does_not_match(self):
        assert domain_matches("rep@example.org", "https://www.adobe.com/") is False


@pytest.mark.django_db
def test_claiming_requires_an_account(client):
    response = client.post(
        URL,
        {"tool": "adobe-acrobat", "work_email": "rep@adobe.com"},
        content_type="application/json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_a_claim_starts_unverified_and_emails_a_code(client, bearer):
    response = client.post(
        URL,
        {"tool": "adobe-acrobat", "work_email": "rep@adobe.com", "role": "PM"},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 201
    claim = ToolClaim.objects.get()
    assert claim.status == ToolClaimStatus.PENDING_VERIFICATION
    assert claim.domain_matched is True
    assert len(mail.outbox) == 1
    assert "rep@adobe.com" in mail.outbox[0].to


@pytest.mark.django_db
def test_the_emailed_code_is_never_stored_in_the_clear(client, bearer):
    client.post(
        URL,
        {"tool": "adobe-acrobat", "work_email": "rep@adobe.com"},
        content_type="application/json",
        **bearer,
    )

    code = ToolClaimCode.objects.get()
    body = mail.outbox[0].body
    assert code.code_hash not in body
    assert not hasattr(code, "code")


@pytest.mark.django_db
def test_a_mismatched_domain_is_routed_to_review_rather_than_refused(client, bearer):
    """Vendor mail often sits on a different domain from the marketing site; that
    is a question for a human, not a rejection."""
    response = client.post(
        URL,
        {
            "tool": "adobe-acrobat",
            "work_email": "rep@adobe-corp.example",
            "evidence": "LinkedIn profile",
        },
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 201
    assert ToolClaim.objects.get().domain_matched is False


@pytest.mark.django_db
def test_the_right_code_moves_the_claim_to_review_and_not_to_approved(client, bearer, claim):
    """A domain match is not authorisation: anyone who can receive mail at the
    domain would otherwise gain edit rights on a ranking page."""
    raw = issue(claim)

    response = client.post(
        f"{URL}/{claim.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    assert response.status_code == 200
    claim.refresh_from_db()
    assert claim.status == ToolClaimStatus.PENDING_REVIEW
    assert claim.email_verified_at is not None


@pytest.mark.django_db
def test_a_wrong_code_is_refused_and_counted(client, bearer, claim):
    issue(claim)

    response = client.post(
        f"{URL}/{claim.pk}/verify", {"code": "000000"}, content_type="application/json", **bearer
    )

    assert response.status_code == 400
    assert ToolClaimCode.objects.get().attempts == 1


@pytest.mark.django_db
def test_a_code_stops_working_after_five_wrong_guesses(client, bearer, claim):
    raw = issue(claim)
    for _ in range(5):
        client.post(
            f"{URL}/{claim.pk}/verify",
            {"code": "000000"},
            content_type="application/json",
            **bearer,
        )

    response = client.post(
        f"{URL}/{claim.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_an_expired_code_is_refused(client, bearer, claim):
    raw = issue(claim)
    ToolClaimCode.objects.update(expires_at=timezone.now() - timezone.timedelta(minutes=1))

    response = client.post(
        f"{URL}/{claim.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_a_code_cannot_be_reused(client, bearer, claim):
    raw = issue(claim)
    client.post(
        f"{URL}/{claim.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    response = client.post(
        f"{URL}/{claim.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_a_code_issued_for_one_claim_cannot_verify_another(client, bearer, claim, user):
    """Codes are bound to the claim, not just to the address - otherwise one code
    would unlock every claim that address ever files."""
    other = ToolClaim.objects.create(
        tool=Tool.objects.get(slug="foxit-editor"),
        user=user,
        work_email="rep@adobe.com",
        email_domain="adobe.com",
    )
    raw = issue(claim)

    response = client.post(
        f"{URL}/{other.pk}/verify", {"code": raw}, content_type="application/json", **bearer
    )

    assert response.status_code == 400
    other.refresh_from_db()
    assert other.status == ToolClaimStatus.PENDING_VERIFICATION


@pytest.mark.django_db
def test_someone_else_cannot_verify_your_claim(client, claim, django_user_model):
    from apps.accounts import jwt

    intruder = django_user_model.objects.create_user(email="in@truder.example", name="I")
    raw = issue(claim)

    response = client.post(
        f"{URL}/{claim.pk}/verify",
        {"code": raw},
        content_type="application/json",
        headers={"Authorization": f"Bearer {jwt.encode_access_token(intruder)}"},
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_one_claim_per_person_per_tool(client, bearer, claim):
    response = client.post(
        URL,
        {"tool": "adobe-acrobat", "work_email": "rep@adobe.com"},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_a_claim_code_authenticates_nothing(claim):
    """The security property this whole model exists for: a claim code lives in
    its own table with no relationship to the auth path, so there is no purpose
    field to get wrong and no login it can be replayed against."""
    from apps.accounts import jwt

    raw = issue(claim)

    with pytest.raises(jwt.TokenError):
        jwt.authenticate_token(raw, jwt.ACCESS_TOKEN_TYPE)


def issue(claim):
    from apps.catalog.claims import issue_claim_code

    return issue_claim_code(claim)
