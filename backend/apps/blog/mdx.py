"""A guest post as a starting MDX file for `frontend/content/blog/`.

Values are JSON-quoted, which YAML reads as plain strings, so a colon or a quote in
a title cannot break the frontmatter. `authors` is left for the editor: the blog
only accepts ids registered in `src/lib/blog/authors.ts`.
"""

import json

from django.utils import timezone
from django.utils.text import slugify


def filename(submission):
    return f"{slugify(submission.title) or f'post-{submission.pk}'}.mdx"


def render(submission):
    byline = ", ".join(part for part in (submission.author_name, submission.author_role) if part)
    lines = [
        "---",
        f"title: {json.dumps(submission.title)}",
        f"description: {json.dumps(submission.description)}",
        f"date: {json.dumps(timezone.localdate().isoformat())}",
        f"tags: {json.dumps(submission.tags)}",
        "draft: true",
        f"# authors: register {json.dumps(byline)} in src/lib/blog/authors.ts, then add the id",
        *(f"# author link: {link}" for link in submission.author_links),
        "---",
        "",
        submission.body_md.strip(),
        "",
    ]
    return "\n".join(lines)
