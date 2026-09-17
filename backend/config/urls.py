from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from config.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Browser-based allauth views: used for admin login and for the OAuth
    # handshake callbacks, which the headless flows rely on too.
    path("accounts/", include("allauth.urls")),
    # The auth API the frontend calls (app client returns our JWTs).
    path("_allauth/", include("allauth.headless.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
