"""The one `CommentSettings` row, with moderation on and trust after 3 comments.

Guarded by an existence check, like the catalog seeds, so it is a no-op on a
database where staff have already changed the row.
"""

from django.db import migrations


def seed(apps, schema_editor):
    CommentSettings = apps.get_model("comments", "CommentSettings")
    if not CommentSettings.objects.filter(pk=1).exists():
        CommentSettings.objects.create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("comments", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
