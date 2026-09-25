import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Manager for the email-identified user model."""

    use_in_migrations = True

    def _create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        # Google users have no local password; set_password(None) marks it unusable.
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Application user.

    Identified by email; there is no username. Signing in happens through Google
    (django-allauth), so `password` is usually unusable.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_("email address"), unique=True)
    name = models.CharField(_("full name"), max_length=255, blank=True)
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(_("staff status"), default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.name or self.email

    def get_short_name(self):
        return self.name.split(" ")[0] if self.name else self.email


class CliLoginStatus(models.TextChoices):
    PENDING = "pending", "Waiting for approval"
    APPROVED = "approved", "Approved"
    DENIED = "denied", "Denied"
    CONSUMED = "consumed", "Key issued"


class CliLogin(models.Model):
    """One `pdfredeval login`, from the code the CLI shows to the key it receives.

    A device-code flow (RFC 8628 in spirit): the CLI never sees a password or a browser
    session, and the key never passes through a URL. `device_code` is the CLI's secret
    for polling, stored as a SHA-256 like a password would be; `user_code` is the short
    code a person reads off the terminal and confirms in the browser.
    """

    device_code_hash = models.CharField(max_length=64, unique=True)
    user_code = models.CharField(max_length=9, db_index=True)
    client_name = models.CharField(max_length=80)
    status = models.CharField(
        max_length=16, choices=CliLoginStatus.choices, default=CliLoginStatus.PENDING
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "accounts_cli_login"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_code} ({self.client_name}, {self.status})"

    @property
    def expired(self):
        return self.expires_at <= timezone.now()
