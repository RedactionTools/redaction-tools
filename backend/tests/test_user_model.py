import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_create_user_normalizes_email_and_has_no_usable_password():
    user = User.objects.create_user(email="User@Example.COM")

    assert user.email == "User@example.com"
    assert not user.has_usable_password()
    assert user.is_active
    assert not user.is_staff


@pytest.mark.django_db
def test_create_superuser_is_staff_and_superuser():
    user = User.objects.create_superuser(email="admin@example.com", password="s3cret!!")

    assert user.is_staff
    assert user.is_superuser
    assert user.check_password("s3cret!!")


@pytest.mark.django_db
def test_create_user_requires_an_email():
    with pytest.raises(ValueError, match="email"):
        User.objects.create_user(email="")


@pytest.mark.django_db
def test_get_full_name_falls_back_to_email():
    assert User.objects.create_user(email="a@example.com").get_full_name() == "a@example.com"
    assert User.objects.create_user(email="b@example.com", name="Ada L").get_full_name() == "Ada L"
