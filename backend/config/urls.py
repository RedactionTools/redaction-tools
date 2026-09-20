from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from apps.core.views import serve_media
from config.api import api
from config.mcp import server as mcp_server

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Browser-based allauth views: used for admin login and for the OAuth
    # handshake callbacks, which the headless flows rely on too.
    path("accounts/", include("allauth.urls")),
    # The auth API the frontend calls (app client returns our JWTs).
    path("_allauth/", include("allauth.headless.urls")),
    # The staff MCP server, and the OAuth authorization server claude.ai
    # authorises against. No trailing slash, and the segment has to stay
    # `mcp`: the protected-resource document is published at
    # /.well-known/oauth-protected-resource/mcp, derived from this path.
    path("mcp", mcp_server),
    path("oauth/", include("django_mcpz.oauth.urls")),
    path("", include("django_mcpz.oauth.wellknown")),
]

# Uploads, at every DEBUG setting. Nothing else in the stack serves them:
# whitenoise handles STATIC_ROOT only, and the Caddy in front belongs to the
# pdf-redaction stack and has no mount for this volume. The responses are
# immutable and cacheable, which is what makes serving them from gunicorn
# affordable - see apps/core/views.py.
urlpatterns += [
    re_path(rf"^{settings.MEDIA_URL.lstrip('/')}(?P<path>.*)$", serve_media, name="media"),
]
