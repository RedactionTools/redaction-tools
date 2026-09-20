import { describe, expect, it } from 'vitest'

import { makeScreenshot, makeToolDetail } from '@/features/catalog/fixtures'

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  toolId,
  websiteJsonLd,
} from './json-ld'

const SITE = 'https://redaction-tools.com'

describe('softwareApplicationJsonLd', () => {
  it('claims one stable @id for the tool entity', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect(node['@type']).toBe('SoftwareApplication')
    expect(node['@id']).toBe(`${SITE}/tool/adobe-acrobat#software`)
  })

  it('describes it as a security application, not a generic Product', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect(node.applicationCategory).toBe('SecurityApplication')
    expect(node['@type']).not.toBe('Product')
  })

  it('credits the vendor as the author', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect(node.author).toEqual({ '@type': 'Organization', name: 'Adobe' })
  })

  // schema.org's own property for this, and one of the few Google names for a
  // software result - the pictures are on the page either way, so the only cost
  // of omitting them was that nothing machine-readable said what they were.
  it('lists the listing screenshots as the application screenshots', () => {
    const node = softwareApplicationJsonLd(
      SITE,
      makeToolDetail({ screenshots: [makeScreenshot()] }),
    )

    expect(node.screenshot).toEqual([makeScreenshot().url])
  })

  it('omits screenshot entirely when the listing has none', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect('screenshot' in node).toBe(false)
  })

  it('aggregates the published prices into a single offer range', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect(node.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '22.99',
      highPrice: '22.99',
      priceCurrency: 'USD',
      offerCount: 1,
    })
  })

  it('omits offers entirely when nothing is published, rather than claiming zero', () => {
    const tool = makeToolDetail()
    tool.plans = tool.plans.map((plan) => ({ ...plan, prices: [] }))

    expect(softwareApplicationJsonLd(SITE, tool).offers).toBeUndefined()
  })

  it('never invents a rating', () => {
    const node = softwareApplicationJsonLd(SITE, makeToolDetail())

    expect(node.aggregateRating).toBeUndefined()
    expect(node.review).toBeUndefined()
  })

  it('keeps provenance out of structured data', () => {
    const serialised = JSON.stringify(softwareApplicationJsonLd(SITE, makeToolDetail()))

    expect(serialised).not.toContain('editor-vetted')
    expect(serialised).not.toContain('manual')
  })
})

describe('itemListJsonLd', () => {
  it('points at tool pages rather than redefining them', () => {
    const node = itemListJsonLd(SITE, [{ slug: 'adobe-acrobat', name: 'Adobe Acrobat' }])

    expect(node.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      url: `${SITE}/tool/adobe-acrobat`,
      name: 'Adobe Acrobat',
    })
  })
})

describe('collectionPageJsonLd', () => {
  it('describes the hub without duplicating any tool entity', () => {
    const node = collectionPageJsonLd(SITE, { name: 'Redaction tools', numberOfItems: 7 })

    expect(node['@type']).toBe('CollectionPage')
    expect(JSON.stringify(node)).not.toContain('SoftwareApplication')
  })
})

describe('breadcrumbJsonLd', () => {
  it('walks from the hub down to the tool', () => {
    const node = breadcrumbJsonLd(SITE, [
      { name: 'Tools', url: `${SITE}/` },
      { name: 'Adobe Acrobat', url: toolId(SITE, 'adobe-acrobat') },
    ])

    expect(node.itemListElement).toHaveLength(2)
    expect(node.itemListElement[1].position).toBe(2)
  })
})

describe('websiteJsonLd', () => {
  const node = () => websiteJsonLd(SITE, { name: 'Redaction Tools', description: 'A catalog.' })

  it('claims one stable @id for the site', () => {
    expect(node()['@type']).toBe('WebSite')
    expect(node()['@id']).toBe(`${SITE}/#website`)
  })

  it('names its publisher by pointer rather than redefining it', () => {
    expect(node().publisher).toEqual({ '@id': `${SITE}/#organization` })
  })

  // Retired by Google in 2024, and it would advertise `/?q=` - a URL robots.txt
  // disallows. Declaring a crawl entry point we have closed is worse than none.
  it('advertises no search action', () => {
    expect(node().potentialAction).toBeUndefined()
  })
})

describe('organizationJsonLd', () => {
  const node = () =>
    organizationJsonLd(SITE, {
      name: 'Redaction Tools',
      description: 'A catalog.',
      logo: `${SITE}/images/RedactionToolsLogo.png`,
      sameAs: ['https://www.reddit.com/r/RedactionTools/'],
    })

  it('claims one stable @id the site can point at', () => {
    expect(node()['@type']).toBe('Organization')
    expect(node()['@id']).toBe(`${SITE}/#organization`)
  })

  it('gives the logo as a resolvable absolute URL', () => {
    expect(node().logo).toMatchObject({
      '@type': 'ImageObject',
      url: expect.stringMatching(/^https:/),
    })
  })

  it('lists the profiles that speak for us', () => {
    expect(node().sameAs).toEqual(['https://www.reddit.com/r/RedactionTools/'])
  })
})

describe('collectionPageJsonLd', () => {
  it('anchors the catalog to the site it belongs to', () => {
    const node = collectionPageJsonLd(SITE, { name: 'Redaction tools', numberOfItems: 7 })

    expect(node.isPartOf).toEqual({ '@id': `${SITE}/#website` })
  })
})

describe('faqPageJsonLd', () => {
  const PAGE = `${SITE}/tool/adobe-acrobat`

  it('marks up the questions a listing answers', () => {
    const node = faqPageJsonLd(PAGE, [{ question: 'Does it remove text?', answer: 'Yes.' }])

    expect(node?.['@type']).toBe('FAQPage')
    expect(node?.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Does it remove text?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
      },
    ])
  })

  // An empty FAQPage is a claim that the page answers nothing, which is worse
  // than saying nothing at all.
  it('emits nothing rather than an empty FAQPage', () => {
    expect(faqPageJsonLd(PAGE, [])).toBeUndefined()
  })
})
