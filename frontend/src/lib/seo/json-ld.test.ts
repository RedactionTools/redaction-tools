import { describe, expect, it } from 'vitest'

import { makeToolDetail } from '@/features/catalog/fixtures'

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
  softwareApplicationJsonLd,
  toolId,
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
