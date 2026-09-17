"""Original editorial for the launch catalog, then publish it.

`is_listable()` demands 400+ characters of our own prose per tool, which is what
separates a page from a database row. Vendor copy never counts toward it, so
nothing here is lifted from a vendor site.

Summaries are written to be liftable: each states what the tool is, what it
redacts and what it costs, with the unit and currency in the same sentence,
because models quote sentences rather than table cells.
"""

from django.db import migrations

EDITORIAL = {
    "pdf-redaction": {
        "summary": (
            "PDF Redaction is a browser-based tool that finds and permanently removes "
            "sensitive text from PDFs, with a free tier capped at 25 pages per document "
            "and paid plans from $15 per month or $0.05 per page."
        ),
        "description_md": (
            "PDF Redaction runs in the browser and combines automatic entity detection with a "
            "manual review pass, so a person confirms every match before anything is removed. "
            "Redaction is destructive rather than cosmetic: the underlying text objects are "
            "deleted from the file, not covered with a black rectangle, which is the difference "
            "between a redacted document and one that can be recovered by selecting the text.\n\n"
            "It is disclosed here as our own product. It appears in this catalog on the same "
            "terms as every other entry, is never sorted to the top, and its pricing is recorded "
            "the same way. The free tier is a genuine free tier rather than a trial, and the "
            "per-page option exists for people who redact occasionally and do not want a "
            "subscription. Self-hosted and API deployments are available for teams that cannot "
            "send documents to a third party."
        ),
        "pros": [
            "Genuine free tier rather than a time-limited trial",
            "True content removal, not a drawn rectangle",
            "Per-page pricing for occasional use",
            "Self-hosted and API options",
        ],
        "cons": [
            "Documents only - no video or audio redaction",
            "Smaller feature surface than a full PDF editor",
        ],
    },
    "adobe-acrobat": {
        "summary": (
            "Adobe Acrobat Pro is the industry-standard PDF editor and includes search-and-"
            "redact plus document sanitization, at $22.99 per month after a 7-day trial. "
            "There is no free tier."
        ),
        "description_md": (
            "Acrobat is the reference implementation of PDF editing, and its redaction tool is "
            "correspondingly thorough: it removes the underlying content, strips metadata through "
            "a separate sanitization step, and can apply redaction patterns across a batch of "
            "files. For organisations that already standardise on Acrobat, redaction is a feature "
            "they have rather than a tool they buy.\n\n"
            "What it is not is cheap or automatic. Detection is pattern-based and manual rather "
            "than model-driven, so finding every instance of a name across a long document is the "
            "operator's problem. The 7-day trial is a trial, not a free tier - redaction is "
            "unavailable on the free Acrobat Reader entirely, which is the single most common "
            "misunderstanding about this product."
        ),
        "pros": [
            "Removes underlying content and metadata properly",
            "Batch redaction across many files",
            "Already deployed in most large organisations",
        ],
        "cons": [
            "No free tier; redaction is absent from Acrobat Reader",
            "Detection is manual and pattern-based",
            "The most expensive per-seat option in this catalog",
        ],
    },
    "nitro-pdf": {
        "summary": (
            "Nitro PDF Pro is a Windows-first Acrobat alternative with manual redaction, priced "
            "at EUR 14 per seat per month after a 14-day trial. There is no free tier."
        ),
        "description_md": (
            "Nitro positions itself as the cheaper per-seat alternative to Acrobat for "
            "organisations that mostly need editing, conversion and signing, with redaction as "
            "part of the package. The redaction tool itself is conventional: mark text or areas, "
            "apply, and the content is removed from the file rather than hidden.\n\n"
            "The trade-off is platform reach. Nitro is a Windows product first and its macOS and "
            "web coverage lags, so mixed-fleet teams tend to end up with two tools. Detection is "
            "manual, with no entity recognition, which makes it a poor fit for high-volume "
            "document review but perfectly adequate for redacting a handful of contracts a week."
        ),
        "pros": [
            "Cheaper per seat than Acrobat",
            "Familiar editing and conversion suite around the redaction tool",
        ],
        "cons": [
            "Windows-first; weaker macOS coverage",
            "Manual detection only",
            "No free tier",
        ],
    },
    "foxit-editor": {
        "summary": (
            "Foxit PDF Editor is a cross-platform PDF suite with manual redaction and metadata "
            "removal, from $12.99 per month after a 14-day trial. There is no free tier."
        ),
        "description_md": (
            "Foxit competes on price against Acrobat while covering both Windows and macOS, and "
            "its redaction tool does the two things that matter: it removes the underlying text "
            "and it can strip document metadata in the same pass. For teams priced out of Acrobat "
            "but unwilling to give up a full editor, it is the usual landing place.\n\n"
            "Redaction is a feature of a general-purpose editor rather than the product's focus, "
            "so there is no automatic detection of names, addresses or identifiers - an operator "
            "searches and marks. That is fine for occasional work and slow for anything "
            "resembling document review at volume. Pricing is straightforward and published, "
            "which is more than several competitors in this catalog manage."
        ),
        "pros": [
            "Cheapest full PDF editor here with real redaction",
            "Windows and macOS coverage",
            "Published, machine-readable pricing",
        ],
        "cons": [
            "No automatic detection",
            "Redaction is a side feature, not the focus",
            "No free tier",
        ],
    },
    "caseguard": {
        "summary": (
            "CaseGuard Studio redacts video, audio, images and documents with automatic face and "
            "licence-plate detection, at $279 per seat per month. It is sold to government and "
            "law-enforcement teams and has no free tier."
        ),
        "description_md": (
            "CaseGuard is the only tool in this catalog that treats footage as a first-class "
            "input rather than an afterthought. It detects and tracks faces and licence plates "
            "across video frames, transcribes and bleeps audio, and writes an audit log of what "
            "was redacted and by whom - which is the part that matters when the output is "
            "disclosed in response to a records request.\n\n"
            "It is priced accordingly, at roughly ten times the per-seat cost of a document-only "
            "tool, and it is a Windows desktop application rather than a service. That combination "
            "makes it a poor fit for anyone who occasionally needs to redact a PDF, and close to "
            "the only sensible choice for a public agency processing body-camera footage under a "
            "statutory deadline."
        ),
        "pros": [
            "Video, audio, image and document redaction in one tool",
            "Automatic face and licence-plate tracking",
            "Audit logging suited to disclosure workflows",
        ],
        "cons": [
            "By far the highest per-seat price in this catalog",
            "Windows desktop only",
            "Overkill for document-only work",
        ],
    },
    "redactable": {
        "summary": (
            "Redactable is a cloud tool built specifically for redaction, with AI detection and a "
            "free tier capped at 2 documents per month; paid plans start at $29 per month or "
            "about $1 per document."
        ),
        "description_md": (
            "Redactable is one of the few products here that is a redaction tool rather than an "
            "editor with a redaction button. It detects sensitive entities automatically, removes "
            "the underlying content, and issues a certificate recording what was removed - useful "
            "when a client or court wants evidence that the redaction was performed rather than "
            "drawn.\n\n"
            "Being cloud-only is the main constraint: documents are uploaded, which rules it out "
            "for air-gapped environments and for material that cannot leave a jurisdiction. The "
            "free tier is real but tightly capped at two documents a month, so it functions as an "
            "evaluation path rather than a usable plan. Per-document pricing makes it easy to "
            "cost a one-off disclosure exercise without committing to a subscription."
        ),
        "pros": [
            "Purpose-built for redaction rather than general editing",
            "Automatic entity detection with a redaction certificate",
            "Per-document pricing for one-off work",
        ],
        "cons": [
            "Free tier capped at 2 documents per month",
            "Cloud-only; no self-hosted or air-gapped option",
            "Documents only",
        ],
    },
    "ilovepdf": {
        "summary": (
            "iLovePDF is an online PDF toolbox where redaction is one tool among dozens, with a "
            "capped free tier and Premium at EUR 9 per month. Detection is entirely manual."
        ),
        "description_md": (
            "iLovePDF is a general-purpose PDF toolbox - merge, split, compress, convert - that "
            "added redaction alongside everything else. For someone who already uses it for "
            "conversions and needs to black out a few lines, that convenience is the whole "
            "argument, and the free tier means there is nothing to buy for a one-off job.\n\n"
            "Treat the redaction feature with care. There is no automatic detection, no audit "
            "trail, and the free tier's caps are not published as numbers, which is why this "
            "catalog records them as unpublished rather than inventing a figure. For a single "
            "page with two lines to remove it is entirely adequate; for anything where a failed "
            "redaction has consequences, a purpose-built tool is the better answer."
        ),
        "pros": [
            "Free tier that is genuinely usable for one-off jobs",
            "Redaction sits alongside conversion and merging tools",
            "Cheapest paid plan in this catalog",
        ],
        "cons": [
            "Manual detection only, with no audit trail",
            "Free-tier limits are not published",
            "Redaction is a minor feature of a general toolbox",
        ],
    },
}


def seed(apps, schema_editor):
    Tool = apps.get_model("catalog", "Tool")

    for slug, editorial in EDITORIAL.items():
        updated = Tool.objects.filter(slug=slug, description_md="").update(
            summary=editorial["summary"],
            description_md=editorial["description_md"],
            pros=editorial["pros"],
            cons=editorial["cons"],
        )
        if updated:
            Tool.objects.filter(slug=slug).update(status="published")


def noop_reverse(apps, schema_editor):
    """Unpublishing on reverse would hide live pages; editorial stays."""


class Migration(migrations.Migration):
    dependencies = [("catalog", "0008_seed_tools")]

    operations = [migrations.RunPython(seed, noop_reverse)]
