"""The SSRF guard on every user-supplied URL.

Tests use IP literals rather than hostnames so they never depend on DNS.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.validators import validate_external_url, validate_logo_url


@pytest.mark.parametrize("url", ["https://93.184.216.34/pricing", "http://8.8.8.8/"])
def test_public_urls_are_accepted(url):
    validate_external_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://93.184.216.34/",
        "gopher://93.184.216.34/",
        "data:text/html,hi",
    ],
)
def test_non_http_schemes_are_rejected(url):
    with pytest.raises(ValidationError):
        validate_external_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata
        "http://127.0.0.1:8007/admin/",
        "http://10.0.0.1/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://[::1]/",
    ],
)
def test_private_and_loopback_addresses_are_rejected(url):
    with pytest.raises(ValidationError):
        validate_external_url(url)


def test_blocked_compose_hostnames_are_rejected(settings):
    """A dev environment must fail closed on its own service names."""
    settings.CATALOG_BLOCKED_HOSTS = ["backend", "db"]

    with pytest.raises(ValidationError):
        validate_external_url("http://backend:8007/api/v1/auth/me")


def test_a_site_relative_logo_path_is_accepted():
    """Logos are re-hosted rather than hotlinked, so they are site-relative paths."""
    validate_logo_url("/images/tools/adobe.svg")


@pytest.mark.parametrize("url", ["http://169.254.169.254/logo.svg", "javascript:alert(1)"])
def test_a_logo_url_still_cannot_point_inward(url):
    with pytest.raises(ValidationError):
        validate_logo_url(url)
