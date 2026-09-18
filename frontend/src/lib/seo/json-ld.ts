import type { ToolDetailOut } from '@/lib/api/generated/model'

/**
 * Structured data for the catalog.
 *
 * One ownership rule runs through all of it: the tool entity and its offers are
 * defined ONLY on `/tool/<slug>/`. The hub and, later, the leaderboard reference
 * that `@id` as a bare pointer and never redefine it - two pages defining the
 * same entity is the classic duplicate-entity error.
 */

export function toolUrl(site: string, slug: string): string {
  return `${site}/tool/${slug}`
}

/** The canonical identifier for a tool entity, referenced from everywhere else. */
export function toolId(site: string, slug: string): string {
  return `${toolUrl(site, slug)}#software`
}

function aggregateOffer(tool: ToolDetailOut) {
  // Overage rates are excluded: a surcharge past an allowance is not something
  // anyone can buy, so counting it would inflate `offerCount` and could hand
  // `lowPrice` a figure that is not an offer at all.
  const prices = tool.plans.flatMap((plan) => plan.prices.filter((price) => !price.is_overage))
  if (prices.length === 0) return undefined

  const amounts = prices.map((price) => Number(price.amount))
  const format = (value: number) => value.toFixed(2)

  return {
    '@type': 'AggregateOffer',
    lowPrice: format(Math.min(...amounts)),
    highPrice: format(Math.max(...amounts)),
    priceCurrency: prices[0].currency,
    offerCount: prices.length,
    url: tool.pricing_url || tool.website_url,
  }
}

/**
 * Note what is absent: no `Product` alongside this, and no `aggregateRating`.
 * We publish no first-party ratings, and inventing one is a manual-action risk.
 *
 * Provenance is absent too. There is no schema.org property for "who told us
 * this", and expressing it through `additionalProperty` would risk a
 * structured-data mismatch for no gain - it lives in the visible HTML instead.
 */
export function softwareApplicationJsonLd(site: string, tool: ToolDetailOut) {
  return {
    '@type': 'SoftwareApplication',
    '@id': toolId(site, tool.slug),
    name: tool.name,
    url: toolUrl(site, tool.slug),
    description: tool.summary,
    applicationCategory: 'SecurityApplication',
    author: { '@type': 'Organization', name: tool.vendor.name },
    publisher: { '@type': 'Organization', name: tool.vendor.name },
    offers: aggregateOffer(tool),
  } as Record<string, unknown> & {
    '@type': string
    '@id': string
    applicationCategory: string
    author: unknown
    offers?: unknown
    aggregateRating?: unknown
    review?: unknown
  }
}

export function itemListJsonLd(site: string, tools: { slug: string; name: string }[]) {
  return {
    '@type': 'ItemList',
    itemListElement: tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      // URL form, never an embedded object: the entity is defined on its own page.
      url: toolUrl(site, tool.slug),
      name: tool.name,
    })),
  }
}

export function collectionPageJsonLd(
  site: string,
  { name, numberOfItems }: { name: string; numberOfItems: number },
) {
  return {
    '@type': 'CollectionPage',
    '@id': `${site}/#catalog`,
    name,
    url: `${site}/`,
    numberOfItems,
  }
}

export function breadcrumbJsonLd(site: string, crumbs: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

/** Wrap nodes in one `@graph`, which is how a page emits several at once. */
export function combineJsonLd(nodes: unknown[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
}
