# Changelog

Notable changes to redaction-tools, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are
named by the date they shipped rather than by a semantic version — this is a catalog, not a
library, and nothing downstream pins a version of it. The commit each entry came from is
given in brackets.

## Unreleased

### Added

- **Cheapest plan marked in the cost calculator** — the table now names the plan that costs
  least for the volume in the fields, and says so in words rather than by tint alone. A flat
  fee that covers the work counts at that fee; an annual or per-seat fee does not, because
  turning one into this month's bill needs a divisor no vendor published. Mixed currencies
  get no answer at all. A joint-cheapest pair is named as such rather than broken arbitrarily.
- **A 25-page preset** on pages per document — the free tier's per-document cap across the
  catalog, and the point where the ranking starts to move.
- **Staff MCP server** at `/mcp` — reads and edits the catalog from Claude: list listings,
  read one with the reasons it is not yet a public page, edit it, edit its plans, publish a
  price. A plain synchronous Django view (django-mcpz), so it runs inside the existing
  gunicorn process; OAuth at `/oauth/` makes it addable as a claude.ai custom connector, and
  `make backend-mcp-token` mints a bearer token for a terminal. Staff only, and every edit
  lands in the revision queue staff already read.

### Changed

- `Tool.is_listable()` now delegates to `listability_blockers()`, which names each reason a
  tool falls short instead of only answering yes or no. Same verdict, same queries.

## [2026-09-18]

First release: the catalog, submissions, vendor claims, sign-in and the price calculator.

### Added

- **Price calculator** — `/price-calculator` costs a month of work against every plan of any
  tool in the catalog, and the same table appears on each tool's page. The arithmetic runs on
  integer ten-thousandths, so a per-page rate survives the sum; a per-page column shows where
  per-document pricing overtakes per-page. Plans carry overage rates and page limits, so a
  metered plan is priced past its allowance and one that caps out with no such rate says so
  rather than quoting a figure it would not honour. A flat subscription reads *Included in the
  plan*: dividing a monthly fee by a volume no vendor published is the one sum the catalog
  refuses. [`7921986`]
- **A worked example on the calculator** — the volume fields are answerable before a tool is
  chosen, and until one is, three invented plans price that volume so the page shows what the
  answer looks like. The rates are clearly marked as fabricated and carry no provenance badge.
  [`a013099`]
- **Footer** — logo and wordmark, the copyright year read at render, and links to
  [r/RedactionTools](https://www.reddit.com/r/RedactionTools/) and
  [LinkedIn](https://www.linkedin.com/company/redaction-tools/). [`a013099`]
- **The catalog** — tools, vendors, plans, prices and limits, a facet taxonomy, and editorial,
  seeded idempotently by migration. `Tool.is_listable()` gates every public route, so a tool
  missing a vendor, a link, a logo, a facet or our own writing is a row rather than a page.
  Filtering is OR within a dimension and AND across. Routes: the hub, tool profiles,
  `/methodology`, `/submit` and `/my-listings`, with `robots.ts`, `sitemap.ts` and JSON-LD.
  [`37e13ce`]
- **Submissions, claims and price proposals** — `ToolSubmission` takes tools we are missing;
  `ToolClaim` and `ToolClaimCode` let a vendor prove ownership of a listing; `PriceProposal`
  and `ToolRevision` are the only path from an owner to a published number, and it passes a
  person. `PlanPrice.save()` pins anything non-crawler, so automation can never overwrite a
  figure staff or a vendor supplied. [`37e13ce`]
- **Accounts and sign-in** — the frontend takes a Google ID token, trades it at allauth's
  headless endpoint for our own JWT pair, and sends the access token as a bearer. Refresh
  tokens rotate; access tokens live 15 minutes. Session cookies remain, but only for the Django
  admin and the server-rendered `/accounts/` views. [`5b3ad68`]
- **The application shell** — Django 6.1 with django-ninja on PostgreSQL 17; Next.js 16 and
  React 19 with the `(site)` chrome group, a literal `auth/` segment, `src/proxy.ts` middleware,
  TanStack Query, UI primitives, dark mode and a health page. [`5b3ad68`]
- **The generated API contract** — Python routers produce `backend/openapi.json`, which
  produces the typed Orval client under `frontend/src/lib/api/generated/`. Both artefacts are
  committed and CI fails if either is stale; operation ids come from the view function name, and
  a test enforces that those stay unique across the API. [`5b3ad68`, `37e13ce`]
- **Deployment** — a production compose stack behind Caddy, deploy and setup scripts with
  `DEPLOY.md`, and GitHub Actions for CI and deploy. [`400b584`, `7326114`, `06af52b`,
  `725d394`]

### Changed

- **Money never renders on a single decimal.** Trailing zeroes still go, so `$15.0000` reads as
  `$15`, but a fractional amount keeps at least two places — `$0.1000` was rendering as `$0.1`,
  which is not how a price is written. [`a013099`]
- **The calculator's volume fields moved up to the page**, above the tool picker, so the volume
  is asked once and survives choosing a tool instead of resetting inside the table. A tool
  profile still renders its own. The default month is now 10 documents of 10 pages.
  [`a013099`]
- **Container images moved to alpine bases**, cutting the deployed image size. [`1e49024`]
- **Compose services are addressed by network alias.** `backend` sits on a shared network where
  `db` is ambiguous — another stack has one — so `DATABASE_URL` names
  `redaction-tools-db` explicitly. [`9bcd1a5`]

### Fixed

- **Server-rendered API calls no longer hang.** They reach gunicorn over the compose network as
  plain HTTP, with no Caddy in the path to set `X-Forwarded-Proto`; Django's
  `SECURE_SSL_REDIRECT` then answered with a 301 to a port that speaks no TLS. The header is
  sent from the server only — from a browser it would force a CORS preflight the API does not
  allow. [`0f50d50`]
- **Sign-in no longer fails behind that same redirect.** On the allauth token POSTs the 301 was
  fatal rather than slow: the redirect drops the body and turns the request into a GET.
  [`65fd558`]
- **`remote_ssh` works again on macOS.** bash 3.2 treats an empty array as unbound under
  `set -u`, so a bare `"${tty_flag[@]}"` aborted every call that did not pass `-t`. [`3e8caed`]

[2026-09-18]: https://github.com/RedactionTools/redaction-tools/releases/tag/2026-09-18
