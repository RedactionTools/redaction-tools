"""`manage.py mcp_token` - the credential a terminal uses against /mcp."""

import pytest
from django.core.management import CommandError, call_command

pytestmark = pytest.mark.django_db


def test_it_prints_a_token_for_a_staff_account(staff_user, capsys):
    call_command("mcp_token", staff_user.email)

    token = capsys.readouterr().out.strip()
    assert token
    from django_mcpz.bearer_tokens.models import Token

    assert Token.objects.filter(user=staff_user).exists()


def test_it_refuses_a_non_staff_account(user):
    """A token that can never do anything is worse than no token."""
    with pytest.raises(CommandError, match="not staff"):
        call_command("mcp_token", user.email)


def test_it_refuses_an_unknown_address(db):
    with pytest.raises(CommandError, match="No account"):
        call_command("mcp_token", "nobody@example.com")


def test_the_daily_cleanup_is_scheduled(db):
    """Open client registration grows a table whether or not anyone connects."""
    from django_q.models import Schedule

    scheduled = dict(Schedule.objects.values_list("name", "func"))

    assert scheduled["mcpz-oauth-cleanup"] == "django_mcpz.oauth.cleanup.clear_expired"
    assert (
        scheduled["mcpz-bearer-token-cleanup"] == "django_mcpz.bearer_tokens.cleanup.clear_expired"
    )
