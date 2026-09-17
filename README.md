<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.png">
  <img src=".github/logo.png" alt="" width="96">
</picture>

# Redaction Tools

A catalog of redaction tools, with prices we verify.

Redaction software is bought under pressure — a disclosure deadline, an audit, a breach — and the
market is hard to compare. Vendors publish prices in different units, some publish none at all,
and "free" can mean a free tier or a fortnight's trial depending on who is writing the page.

This catalog covers tools that redact PDFs, images, video, audio and text. Every listing records
what the tool costs, in what unit, and how we know — read from the vendor's page, typed in by an
editor, or supplied by the vendor and labelled as such.

## The catalog

| Route | What it is |
| --- | --- |
| `/` | The hub: every listed tool, filterable by media, deployment, method and pricing |
| `/tool/<slug>/` | A tool's page — plans, prices, provenance and our own assessment |
| `/submit/` | Tell us about a tool we are missing |
| `/methodology/` | Where prices come from, and what we will not do |
| `/my-listings/` | Owner area for vendors with an approved claim |

## How we treat prices

Three rules run through the whole product, and the test suite enforces each one.

**A trial is not a free tier.** "Free for 14 days" and "free forever" are different products.
They are stored as separate states and rendered separately, because collapsing them is the
single easiest way for a comparison table to mislead.

**Every price says where it came from.** Read automatically from the vendor's page, entered by
one of our editors, or supplied by the vendor — the last marked *not independently verified*,
because it is not. A figure a person entered is pinned, so automation can never silently replace
it.

**Owners propose, editors dispose.** Vendors can claim their listing and correct their own
pricing — they are the authority on what they charge — but only through a reviewed proposal.
There is no path from a vendor to a published number that does not pass a person. A catalog
edited by the vendors it ranks is worth nothing to a buyer.

A tool becomes a page only once it has a vendor, a working link, a logo, a medium, a deployment,
a method, a pricing position and several hundred words of our own writing. Copy supplied by a
vendor never counts toward that, and is shown in a separate, labelled block.

## Status

The catalog, submissions and vendor claims are built. Two things are designed and scheduled but
not yet written — a price crawler that re-reads published pricing pages, and a benchmark
leaderboard measuring how well these tools actually redact. Their tables ship in the first
migration, so the schema will not need reshaping when they arrive.

## Built with

Django 6.1 and django-ninja on PostgreSQL 17, Next.js 16 and React 19 on the front, a typed
client generated from the committed OpenAPI schema, and Google sign-in issuing our own JWTs.

## More

- [`DEVELOPMENT.md`](DEVELOPMENT.md) — running it locally, the auth flow, adding an endpoint
