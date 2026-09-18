import { describe, expect, it } from 'vitest'

import type { PlanLimitOut, PlanOut, PriceOut } from '@/lib/api/generated/model'

import { basePrice, cheapestPlan, documentCost, overagePrice } from './document-cost'

function price(overrides: Partial<PriceOut> = {}): PriceOut {
  return {
    amount: '0.0500',
    currency: 'USD',
    unit: 'page',
    billing_period: 'usage',
    is_overage: false,
    source: 'manual',
    is_pinned: true,
    source_note: '',
    source_evidence_url: '',
    effective_from: '2026-09-15T00:00:00Z',
    ...overrides,
  }
}

function plan(overrides: Partial<PlanOut> = {}): PlanOut {
  return {
    code: 'payg',
    name: 'Pay as you go',
    tier_order: 2,
    is_free_tier: false,
    is_trial: false,
    trial_days: null,
    is_enterprise_quote: false,
    min_seats: 1,
    highlights: [],
    source_url: '',
    verified_at: null,
    prices: [price()],
    limits: [],
    ...overrides,
  }
}

function limit(overrides: Partial<PlanLimitOut> = {}): PlanLimitOut {
  return {
    kind: 'pages_per_document',
    label: 'Pages per document',
    value: 25,
    unit: 'pages',
    is_unlimited: false,
    note: '',
    display: '25 pages',
    ...overrides,
  }
}

describe('documentCost, per page', () => {
  it('multiplies the published rate by the pages asked for', () => {
    expect(documentCost(plan(), { documents: 1, pagesPerDocument: 10 })).toEqual({
      kind: 'amount',
      total: '0.5000',
      perPage: '0.0500',
      currency: 'USD',
    })
  })

  it('scales to a hundred-page document', () => {
    expect(documentCost(plan(), { documents: 1, pagesPerDocument: 100 })).toMatchObject({
      total: '5.0000',
    })
  })

  it('multiplies by the number of documents', () => {
    expect(documentCost(plan(), { documents: 5, pagesPerDocument: 10 })).toMatchObject({
      total: '2.5000',
      perPage: '0.0500',
    })
  })

  it('never drifts from the rate printed in the plan table', () => {
    for (const pagesPerDocument of [1, 3, 10, 100, 9999]) {
      expect(documentCost(plan(), { documents: 1, pagesPerDocument })).toMatchObject({
        perPage: '0.0500',
      })
    }
  })

  it('stays exact where floating point would not', () => {
    // 0.05 * 3 is 0.15000000000000002 in IEEE 754, which would render $0.1500.
    expect(documentCost(plan(), { documents: 1, pagesPerDocument: 3 })).toMatchObject({
      total: '0.1500',
    })
  })

  it('keeps each plan in its own currency, because nothing here converts', () => {
    const euros = plan({ prices: [price({ amount: '0.1000', currency: 'EUR' })] })

    expect(documentCost(euros, { documents: 1, pagesPerDocument: 10 })).toMatchObject({
      currency: 'EUR',
    })
  })
})

describe('documentCost, per document', () => {
  const perDocument = plan({ prices: [price({ amount: '1.0000', unit: 'document' })] })

  it('ignores the page count, which is the point of the unit', () => {
    for (const pagesPerDocument of [1, 10, 100]) {
      expect(documentCost(perDocument, { documents: 1, pagesPerDocument })).toMatchObject({
        total: '1.0000',
      })
    }
  })

  it('shows the per-page rate falling as the document gets longer', () => {
    expect(documentCost(perDocument, { documents: 1, pagesPerDocument: 10 })).toMatchObject({
      perPage: '0.1000',
    })
    expect(documentCost(perDocument, { documents: 1, pagesPerDocument: 100 })).toMatchObject({
      perPage: '0.0100',
    })
  })

  it('rounds the per-page rate rather than truncating it', () => {
    expect(documentCost(perDocument, { documents: 1, pagesPerDocument: 3 })).toMatchObject({
      perPage: '0.3333',
    })
  })

  it('leaves the per-page rate alone when only the document count changes', () => {
    expect(documentCost(perDocument, { documents: 5, pagesPerDocument: 10 })).toMatchObject({
      total: '5.0000',
      perPage: '0.1000',
    })
  })
})

describe('documentCost, plans it will not price', () => {
  it('calls a subscription included rather than dividing it into a page rate', () => {
    for (const unit of ['month', 'year', 'seat_month', 'seat_year', 'one_time']) {
      const subscription = plan({ prices: [price({ amount: '22.9900', unit })] })

      expect(documentCost(subscription, { documents: 1, pagesPerDocument: 100 })).toEqual({
        kind: 'included',
      })
    }
  })

  it('refuses units that do not map onto a page count', () => {
    for (const unit of ['minute', 'credit']) {
      const usage = plan({ prices: [price({ amount: '0.5000', unit })] })

      expect(documentCost(usage, { documents: 1, pagesPerDocument: 10 })).toEqual({
        kind: 'not-comparable',
      })
    }
  })

  it('has nothing to compute for a trial or a quote, neither of which carries a price', () => {
    const trial = plan({ is_trial: true, trial_days: 7, prices: [] })
    const quote = plan({ is_enterprise_quote: true, prices: [] })

    expect(documentCost(trial, { documents: 1, pagesPerDocument: 10 })).toEqual({
      kind: 'not-comparable',
    })
    expect(documentCost(quote, { documents: 1, pagesPerDocument: 10 })).toEqual({
      kind: 'not-comparable',
    })
  })
})

describe('documentCost, published caps', () => {
  it('reports the cap instead of a price the plan cannot honour', () => {
    const capped = plan({ limits: [limit({ value: 25 })] })

    expect(documentCost(capped, { documents: 1, pagesPerDocument: 100 })).toEqual({
      kind: 'over-limit',
      max: 25,
      counts: 'pages',
      per: 'document',
    })
  })

  it('prices a document that fits inside the cap', () => {
    const capped = plan({ limits: [limit({ value: 25 })] })

    expect(documentCost(capped, { documents: 1, pagesPerDocument: 25 })).toMatchObject({
      kind: 'amount',
    })
  })

  it('ignores an unlimited or unpublished cap', () => {
    const unlimited = plan({ limits: [limit({ value: null, is_unlimited: true })] })
    const unpublished = plan({ limits: [limit({ value: null, display: 'Not published' })] })

    expect(documentCost(unlimited, { documents: 1, pagesPerDocument: 500 })).toMatchObject({
      kind: 'amount',
    })
    expect(documentCost(unpublished, { documents: 1, pagesPerDocument: 500 })).toMatchObject({
      kind: 'amount',
    })
  })

  it('ignores caps that say nothing about page volume', () => {
    for (const kind of ['file_size_mb', 'seats', 'retention_days', 'api_calls_per_month']) {
      const unrelated = plan({ limits: [limit({ kind, label: kind, value: 1 })] })

      expect(documentCost(unrelated, { documents: 1, pagesPerDocument: 100 })).toMatchObject({
        kind: 'amount',
      })
    }
  })

  it('counts a monthly allowance across every document asked for', () => {
    // A metered plan's bill moves with the volume, so it carries a figure
    // rather than "included" - which is only true of a plan that does not meter.
    const free = plan({
      prices: [price({ amount: '0.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [limit({ kind: 'pages_per_month', label: 'Pages per month', value: 100 })],
    })

    // Ten ten-page documents is exactly the allowance; the eleventh is not.
    expect(documentCost(free, { documents: 10, pagesPerDocument: 10 })).toMatchObject({
      kind: 'amount',
      total: '0.0000',
    })
    expect(documentCost(free, { documents: 11, pagesPerDocument: 10 })).toEqual({
      kind: 'over-limit',
      max: 100,
      counts: 'pages',
      per: 'month',
    })
  })

  it('will not call work included that the plan cannot take', () => {
    // The check sits ahead of the subscription branch on purpose: a free tier
    // that caps out has not "included" the job, it has declined it.
    const free = plan({
      prices: [price({ amount: '0.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [limit({ kind: 'pages_per_month', label: 'Pages per month', value: 100 })],
    })

    expect(documentCost(free, { documents: 1, pagesPerDocument: 500 })).toMatchObject({
      kind: 'over-limit',
      per: 'month',
    })
  })

  it('applies a monthly allowance to a usage-priced plan too', () => {
    const capped = plan({
      limits: [limit({ kind: 'pages_per_month', label: 'Pages per month', value: 100 })],
    })

    expect(capped.prices[0].unit).toBe('page')
    expect(documentCost(capped, { documents: 1, pagesPerDocument: 101 })).toMatchObject({
      kind: 'over-limit',
      per: 'month',
    })
  })

  // Redactable's free tier takes two documents a month. Priced without that cap
  // a hundred of them cost $0, and the plan was named cheapest in the catalog.
  it('counts a monthly allowance published in documents, not just in pages', () => {
    const free = plan({
      prices: [price({ amount: '0.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [limit({ kind: 'documents_per_month', label: 'Documents per month', value: 2 })],
    })

    expect(documentCost(free, { documents: 2, pagesPerDocument: 10 })).toMatchObject({
      kind: 'amount',
    })
    expect(documentCost(free, { documents: 3, pagesPerDocument: 10 })).toEqual({
      kind: 'over-limit',
      max: 2,
      counts: 'documents',
      per: 'month',
    })
  })

  it('reports the document-length cap ahead of the monthly one', () => {
    // A reader whose document is simply too long cannot fix that by sending
    // fewer of them, so that is the cap worth naming.
    const free = plan({
      prices: [price({ amount: '0.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [
        limit({ kind: 'pages_per_document', label: 'Pages per document', value: 25 }),
        limit({ kind: 'pages_per_month', label: 'Pages per month', value: 100 }),
      ],
    })

    expect(documentCost(free, { documents: 1, pagesPerDocument: 100 })).toEqual({
      kind: 'over-limit',
      max: 25,
      counts: 'pages',
      per: 'document',
    })

    // Short enough documents, too many of them: now the monthly cap is the one.
    expect(documentCost(free, { documents: 20, pagesPerDocument: 10 })).toEqual({
      kind: 'over-limit',
      max: 100,
      counts: 'pages',
      per: 'month',
    })
  })
})

describe('documentCost, metered plans', () => {
  /** $15 a month, 500 pages included, $0.05 a page after that. */
  function metered() {
    return plan({
      name: 'Pro',
      prices: [
        // Newest first, as the API returns them: the overage row sorts ahead of
        // the fee, which is exactly how indexing into `prices` goes wrong.
        price({ amount: '0.0500', unit: 'page', billing_period: 'usage', is_overage: true }),
        price({ amount: '15.0000', unit: 'month', billing_period: 'monthly' }),
      ],
      limits: [limit({ kind: 'pages_per_month', label: 'Pages per month', value: 500 })],
    })
  }

  it('reads the fee, not the overage row, as what the plan costs', () => {
    expect(basePrice(metered())?.amount).toBe('15.0000')
    expect(overagePrice(metered())?.amount).toBe('0.0500')
  })

  it('charges the fee alone while the volume fits the allowance', () => {
    expect(documentCost(metered(), { documents: 50, pagesPerDocument: 10 })).toEqual({
      kind: 'amount',
      total: '15.0000',
      perPage: '0.0300',
      currency: 'USD',
    })
  })

  it('adds the published rate for every page past the allowance', () => {
    // 3,000 pages is 2,500 over, at $0.05 - so $15 + $125.
    expect(documentCost(metered(), { documents: 300, pagesPerDocument: 10 })).toEqual({
      kind: 'amount',
      total: '140.0000',
      perPage: '0.0467',
      currency: 'USD',
      overage: { base: '15.0000', over: 2500, counts: 'pages', rate: '0.0500' },
    })
  })

  it('reports no overage while the volume is inside the allowance', () => {
    const cost = documentCost(metered(), { documents: 1, pagesPerDocument: 10 })

    expect(cost).not.toHaveProperty('overage')
  })

  it('charges from the first page past the line, not the whole volume', () => {
    expect(documentCost(metered(), { documents: 1, pagesPerDocument: 501 })).toMatchObject({
      total: '15.0500',
      overage: { over: 1 },
    })
  })

  it('still stops dead when the plan meters but publishes no overage rate', () => {
    const capped = plan({
      prices: [price({ amount: '15.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [limit({ kind: 'pages_per_month', label: 'Pages per month', value: 500 })],
    })

    expect(documentCost(capped, { documents: 1, pagesPerDocument: 501 })).toEqual({
      kind: 'over-limit',
      max: 500,
      counts: 'pages',
      per: 'month',
    })
  })

  it('takes the tightest allowance when the same cap is recorded twice', () => {
    const twice = plan({
      prices: [price({ amount: '15.0000', unit: 'month', billing_period: 'monthly' })],
      limits: [
        limit({ kind: 'pages_per_month', label: 'Pages per month', value: 500 }),
        limit({ kind: 'pages_per_month', label: '500 pages', value: 300 }),
      ],
    })

    expect(documentCost(twice, { documents: 1, pagesPerDocument: 400 })).toMatchObject({
      kind: 'over-limit',
      max: 300,
    })
  })
})

describe('cheapestPlan', () => {
  const metered = plan({ code: 'payg', prices: [price({ amount: '0.0500' })] })
  const flat = plan({
    code: 'pro',
    prices: [price({ amount: '15.0000', unit: 'month', billing_period: 'monthly' })],
  })

  it('picks the lowest total for the volume asked about', () => {
    // 100 pages of pay-as-you-go is $5, against $15 flat.
    expect(cheapestPlan([metered, flat], { documents: 10, pagesPerDocument: 10 })).toEqual(['payg'])
  })

  it('changes its mind as the volume grows', () => {
    // 1,000 pages is $50 metered, so the flat fee wins.
    expect(cheapestPlan([metered, flat], { documents: 100, pagesPerDocument: 10 })).toEqual(['pro'])
  })

  it('counts a flat monthly fee that covers the work at that fee', () => {
    // "Included in the plan" is still $15 a month, and leaving it out would
    // crown a metered plan that costs more.
    const dear = plan({ code: 'dear', prices: [price({ amount: '1.0000' })] })

    expect(cheapestPlan([dear, flat], { documents: 10, pagesPerDocument: 10 })).toEqual(['pro'])
  })

  it('names every plan tied at the lowest rather than picking one', () => {
    const twin = plan({ code: 'twin', prices: [price({ amount: '0.0500' })] })

    expect(cheapestPlan([metered, twin], { documents: 1, pagesPerDocument: 10 })).toEqual([
      'payg',
      'twin',
    ])
  })

  it('ignores a plan that cannot price the volume at all', () => {
    const capped = plan({
      code: 'free',
      prices: [price({ amount: '0.0000' })],
      limits: [limit({ value: 5 })],
    })

    // Free would win on price, but it will not take a 10-page document.
    expect(cheapestPlan([capped, metered], { documents: 1, pagesPerDocument: 10 })).toEqual([
      'payg',
    ])
  })

  it('refuses to compare across currencies', () => {
    // No published exchange rate, so no honest "cheapest".
    const euros = plan({ code: 'eur', prices: [price({ amount: '0.0100', currency: 'EUR' })] })

    expect(cheapestPlan([metered, euros], { documents: 1, pagesPerDocument: 10 })).toEqual([])
  })

  it('refuses a fee that does not buy a month', () => {
    // An annual fee is not this month's bill, and dividing it by twelve invents
    // a figure the vendor never published.
    const yearly = plan({
      code: 'yearly',
      prices: [price({ amount: '1.0000', unit: 'year', billing_period: 'annual' })],
    })

    expect(cheapestPlan([yearly], { documents: 1, pagesPerDocument: 10 })).toEqual([])
  })

  it('has no answer when nothing can be priced', () => {
    expect(cheapestPlan([], { documents: 1, pagesPerDocument: 10 })).toEqual([])
  })
})
