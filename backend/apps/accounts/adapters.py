from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Maps provider data onto our user model, which has `name` instead of first/last."""

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        name = data.get("name") or " ".join(
            part for part in (data.get("first_name"), data.get("last_name")) if part
        )
        if name:
            user.name = name
        return user
