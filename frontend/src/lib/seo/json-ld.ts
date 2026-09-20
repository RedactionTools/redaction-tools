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
    // Spread rather than set to null: an empty `screenshot` array is a claim
    // that there are none, where the absent property claims nothing.
    ...(tool.screenshots.length > 0
      ? { screenshot: tool.screenshots.map((shot) => shot.url) }
      : {}),
    offers: aggregateOffer(tool),
  } as Record<string, unknown> & {
    '@type': string
    '@id': string
    applicationCategory: string
    author: unknown
    offers?: unknown
    screenshot?: string[]
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
  {
    name,
    description,
    numberOfItems,
  }: { name: string; description?: string; numberOfItems: number },
) {
  return {
    '@type': 'CollectionPage',
    '@id': `${site}/#catalog`,
    name,
    ...(description ? { description } : {}),
    url: `${site}/`,
    numberOfItems,
    // A bare pointer at the node the layout defines - the ownership rule cuts
    // both ways, and the catalog no more redefines the site than the hub
    // redefines a tool.
    isPartOf: { '@id': websiteId(site) },
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

/** The site entity, referenced from the catalog and from the organization. */
export function websiteId(site: string): string {
  return `${site}/#website`
}

/** The publisher entity, referenced from the site. */
export function organizationId(site: string): string {
  return `${site}/#organization`
}

/**
 * The site itself.
 *
 * No `potentialAction`/`SearchAction`: Google retired the sitelinks searchbox
 * in 2024, and the only target we could give it is `/?q=` - a URL `robots.ts`
 * disallows. Advertising a crawl entry point we have deliberately closed is
 * a contradiction for no remaining consumer.
 */
export function websiteJsonLd(
  site: string,
  { name, description }: { name: string; description: string },
) {
  return {
    '@type': 'WebSite',
    '@id': websiteId(site),
    url: `${site}/`,
    name,
    description,
    inLanguage: 'en',
    publisher: { '@id': organizationId(site) },
  } as Record<string, unknown> & {
    '@type': string
    '@id': string
    publisher: unknown
    potentialAction?: unknown
  }
}

/** Who publishes it, and where else that publisher speaks. */
export function organizationJsonLd(
  site: string,
  {
    name,
    description,
    logo,
    sameAs,
  }: { name: string; description: string; logo: string; sameAs: readonly string[] },
) {
  return {
    '@type': 'Organization',
    '@id': organizationId(site),
    name,
    url: `${site}/`,
    description,
    // JSON-LD gets no metadataBase, so every URL in it has to be absolute.
    logo: { '@type': 'ImageObject', url: logo },
    sameAs: [...sameAs],
  }
}

/**
 * The questions a listing answers, when it answers any.
 *
 * Returns undefined rather than an empty `FAQPage`, because a page claiming to
 * answer nothing is a worse claim than one that stays quiet. Callers spread the
 * result, so undefined contributes nothing to the graph.
 *
 * Worth knowing what this does and does not buy: Google restricted FAQ rich
 * results to government and health sites in 2023, so this is not a SERP
 * feature. It is extractable question-and-answer text for the answer engines,
 * which is the point.
 */
export function faqPageJsonLd(
  pageUrl: string,
  faq: readonly { question: string; answer: string }[],
) {
  if (faq.length === 0) return undefined

  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}

/** Wrap nodes in one `@graph`, which is how a page emits several at once. */
export function combineJsonLd(nodes: unknown[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
}
