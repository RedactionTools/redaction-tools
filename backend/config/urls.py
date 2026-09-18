from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
