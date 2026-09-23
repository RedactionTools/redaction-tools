# Changelog

Notable changes to redaction-tools, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases are
named by the date they shipped rather than by a semantic version — this is a catalog, not a
library, and nothing downstream pins a version of it. The commit each entry came from is
given in brackets.

## Unreleased

### Added

- **A documentation section at `/docs`**, built on Fumadocs — seventeen pages across
  methodology, buyer guides, vendor guides and developer reference, authored as MDX and
  prerendered, with a sidebar, table of contents and search. The methodology moved out of
  hardcoded JSX and into `content/docs/methodology.mdx`; `/methodology` redirects there
  permanently, and the sitemap and `llms.txt` list the docs rather than the old URL. Docs
  pages are static because they touch no backend, which is what lets them prerender in the
  image CI builds with no API reachable.

- **A share card on every page** — links to the catalog used to unfurl bare in Slack, LinkedIn
  and everywhere else, because the site carried no Open Graph tags at all. It now declares them
  once, at the root: a tool's card is drawn per request with its name, its vendor and its entry
  price, and everything else gets the site card. Declared once and only once, because Next
  replaces the `openGraph` block rather than merging it — a page that sets its own would
  silently drop the site name and the image along with it.
- **`/llms.txt` and `/llms-full.txt`** — the catalog as plain text, for the readers that are not
  browsers. The first is a short index: a count, the provenance rules, and a line per tool
  carrying the same price sentence the profile shows. The second is a fact block per tool —
  price with its unit and date, entry price, free tier, trial, facets, how the figure was
  obtained and the vendor's own pricing page. Both are built from the list response alone, never
  one request per tool: they are public, uncacheable and fetched by robots, and an N+1 behind
  them would turn one crawl into one request per listing.
- **The questions a listing answers** — `faq` had been carried by the API since the catalog
  shipped and rendered nowhere, because it was typed as a bare list of dicts and reached the
  frontend as `unknown`. It is now a real schema, a "Common questions" block on the profile and
  `FAQPage` markup, each gated on there being a question to answer. Worth knowing what that last
  part does and does not buy: Google restricted FAQ rich results to government and health sites
  in 2023, so this is extractable question-and-answer text for the answer engines rather than a
  search feature.
- **Structured data for the hub and the site** — the homepage emits `CollectionPage` and an
  `ItemList` of every listed tool, and every page a crawler may fetch now carries `WebSite` and
  `Organization`. The builders for the first two had been written and unit-tested months ago and
  imported by nothing. The hub's graph is gated on the unfiltered view: a filtered hub is
  `noindex` and shows a different subset, so letting it claim the same `@id` is the
  duplicate-entity error in a new costume. No `SearchAction` — Google retired the sitelinks
  searchbox in 2024, and the only target available is a URL `robots.txt` disallows.
- **Answer engines named in `robots.txt`** — fourteen of them, plus a crawl delay for the two
  that fetch far more than they cite. The access is the same as anyone else's; what the list
  buys is an auditable statement of who is welcome. Each group repeats the disallow set in full,
  which is not redundancy: a crawler obeys the single most specific group naming it and ignores
  `*` entirely, so a named group that forgot a path would be a named group granted *more* of the
  site than an anonymous one.

- **Screenshots on a listing** — a tool's profile can now show pictures of the product, above
  the plan table, because a buyer works out what a tool is before what it costs and this is the
  only part of the page that shows them the thing rather than describing it. One upload becomes
  a WebP at each of four widths, shipped as a real `srcset` with the figure's dimensions, so a
  phone is not sent the desktop rendition and the page does not reflow as each picture lands.
  Three ways in, one gate: an editor uploads in the admin, a verified owner uploads from
  **My listings**, and `catalog_add_screenshot` fetches a URL for the staff MCP server. An
  owner's upload is a proposal like every other thing they send — stored and rendered at once,
  on the profile only when an editor publishes it, and a rejection keeps its note, which they
  are shown. `alt_text` is required at all three, because a screenshot without it is an image a
  screen reader announces as nothing.
- **A rendition set that can be changed** — sources are kept and every file is named after the
  SHA-256 of its own bytes, so adding a width is `manage.py rerender_screenshots` rather than a
  request to every vendor for a fresh capture. Content-addressed paths also mean the bytes behind
  a URL can never change, which is what lets `/media/` be served with a year's `immutable`
  cache from gunicorn. Two listings may legitimately share a capture, so files are removed only
  when the last row referencing that digest goes.
- **What an upload may be, stated once** in `apps/catalog/images.py`: PNG, JPEG or WebP (a GIF
  would publish as its first frame; SVG is a document that can carry script), 12 MB, and 50
  megapixels checked against the header before anything is decoded — a few hundred KB of PNG can
  declare 900 million pixels, and it is decoding that allocates them. Every source is re-encoded
  on the way in, which is what drops the EXIF that can name the machine a capture was taken on.
  Nothing is ever upscaled: a 320px capture renders once, at 320px.
- **Cheapest plan marked in the cost calculator** — the table now names the plan that costs
  least for the volume in the fields, and says so in words rather than by tint alone. A flat
  fee that covers the work counts at that fee; an annual or per-seat fee does not, because
  turning one into this month's bill needs a divisor no vendor published. Mixed currencies
  get no answer at all. A joint-cheapest pair is named as such rather than broken arbitrarily.
- **The volume in pages**, stated under the calculator's two fields — 10 documents of 10
  pages reads "100 pages a month". That product is what every row is actually priced on and
  the unit the published rates are compared through, so leaving the reader to multiply it
  was how a mistyped field went unnoticed until a total looked wrong.
- **A 25-page preset** on pages per document — the free tier's per-document cap across the
  catalog, and the point where the ranking starts to move.
- **Creating plans over MCP** — `catalog_create_plan` and `catalog_set_plan_limit` join the
  staff tools, so a whole new tier can be built without the admin. A tier is three or four
  calls rather than one: the plan, each published cap, the fee, and the metered rate. Kept
  apart so a single fat call cannot half-succeed and so every figure keeps its own
  provenance. `catalog_create_plan` returns `has_pricing_position`, which stays false until
  the plan has a price, a free-tier flag or the quote-only flag — a tier left there is
  invisible to the public catalog, and the result says so.
- **Staff MCP server** at `/mcp` — reads and edits the catalog from Claude: list listings,
  read one with the reasons it is not yet a public page, edit it, edit its plans, publish a
  price. A plain synchronous Django view (django-mcpz), so it runs inside the existing
  gunicorn process; OAuth at `/oauth/` makes it addable as a claude.ai custom connector, and
  `make backend-mcp-token` mints a bearer token for a terminal. Staff only, and every edit
  lands in the revision queue staff already read.

### Changed

- **A tool's meta description no longer stops at the price.** It still leads with the price
  sentence, which is the string a search result or an answer engine quotes verbatim and is
  therefore never truncated — but the rest of the snippet is now filled with the tagline, then
  the summary's opening sentence, added whole while they fit. "Redactable has a free tier, as of
  15 September 2026." was using a third of the space available to it.
- **`/health` is no longer indexable**, by `noindex` rather than a `robots.txt` disallow: a
  disallowed URL is never fetched, so the crawler never sees the `noindex` and can still index
  it from a stray link.
- **The sitemap reads past the first hundred tools.** It asked for one page of 100 and stopped,
  which was correct for seven tools and silently wrong for the hundred-and-first. The hub entry
  is also dated now, by the newest price change in the catalog — the three trust pages are still
  undated, because the only date available for them is the build date, which moves on every
  deploy while the page sits still.

- `Tool.is_listable()` now delegates to `listability_blockers()`, which names each reason a
  tool falls short instead of only answering yes or no. Same verdict, same queries.

### Fixed

- **The site described a leaderboard it does not have.** "Catalog of redaction tools with
  benchmarks and a leaderboard" was the fallback description on every page that set none of its
  own, the footer blurb and the API's own summary — three hand-written copies, which is why it
  was corrected in none of them when the leaderboard slipped to a later phase. There is now one
  copy, in `frontend/src/lib/seo/site.ts`, and a test that fails if it promises a benchmark
  again. The social links moved there too, since they are also what the `Organization` markup
  claims as ours and an identity claim that disagrees with the footer is worse than none.
- **The auth proxy ran on `robots.txt` and `sitemap.xml`**, and would have run on the new
  machine-readable routes and the share cards. Beyond the wasted token decode, `auth` can attach
  a rotated-session `Set-Cookie` to the response, and putting one of those on a year-cached
  public asset is how a session leaks into a shared cache.
- **The methodology page's title contradicted its own heading** — "How we source prices" against
  "How we verify prices". The heading won; it is the stronger claim and the wording the footer
  already uses.

- **tdd-guard could not see the test suite.** The repo carried the rulebook but not the
  reporter that writes `.claude/tdd-guard/data/test.json`, so the guard had no evidence any
  test had run and refused every implementation edit as unproven — failing closed in the one
  direction that makes the discipline impossible to follow rather than merely unenforced.
  `tdd-guard-pytest` and `tdd-guard-vitest` are now dev dependencies, each pointed at the repo
  root — by `backend/conftest.py` and `vitest.config.ts`. Both suites run from a subdirectory and
  both reporters default to `.claude/tdd-guard/data` relative to the working directory, so left
  alone they write a `backend/.claude/` and a `frontend/.claude/` that nothing reads. Each derives
  the root from its own file's location, which keeps one machine's absolute path out of the repo.
  One `test.json` serves both suites and the last run wins, so a red/green cycle should run the
  component's own suite rather than `make test`.
- **A screenshot could be uploaded with whitespace for alt text** through the owner API. The
  admin form stripped it and the MCP tool refused a blank by name; this was the surface that
  took it, and the field exists to be read aloud to someone who cannot see the picture.

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
