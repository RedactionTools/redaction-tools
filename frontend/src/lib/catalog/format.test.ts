import { describe, expect, it } from 'vitest'

import type { PriceSummaryOut } from '@/lib/api/generated/model'

import { formatAmount, formatUnit, priceHeadline, priceSentence } from './format'

function summary(overrides: Partial<PriceSummaryOut> = {}): PriceSummaryOut {
  return {
    has_free_tier: false,
    is_trial: false,
    trial_days: null,
    is_quote_only: false,
    from_amount: '15.0000',
    currency: 'USD',
    unit: 'month',
    billing_period: 'monthly',
    source: 'manual',
    is_pinned: true,
    source_note: '',
    source_url: 'https://example.com/pricing',
    last_verified_at: '2026-09-15T00:00:00Z',
    last_changed_at: null,
    is_stale: false,
    ...overrides,
  }
}

describe('formatAmount', () => {
  it('renders the currency symbol and drops the storage precision', () => {
    expect(formatAmount('15.0000', 'USD')).toBe('$15')
    expect(formatAmount('22.9900', 'USD')).toBe('$22.99')
    expect(formatAmount('14.0000', 'EUR')).toBe('€14')
  })

  it('keeps sub-cent precision, because per-page pricing needs it', () => {
    expect(formatAmount('0.0500', 'USD')).toBe('$0.05')
  })
})

describe('formatUnit', () => {
  it('spells units out rather than abbreviating them', () => {
    expect(formatUnit('month')).toBe('per month')
    expect(formatUnit('seat_month')).toBe('per seat per month')
    expect(formatUnit('page')).toBe('per page')
    expect(formatUnit('minute')).toBe('per minute')
  })
})

describe('priceHeadline', () => {
  it('shows the entry price for a paid tool', () => {
    expect(priceHeadline(summary())).toBe('From $15 per month')
  })

  it('says Free when there is a genuine free tier', () => {
    expect(priceHeadline(summary({ has_free_tier: true, from_amount: null }))).toBe('Free')
  })

  it('leads with Free but still quotes the paid entry point', () => {
    expect(priceHeadline(summary({ has_free_tier: true }))).toBe('Free, or from $15 per month')
  })

  it('never calls a trial free', () => {
    const headline = priceHeadline(summary({ is_trial: true, trial_days: 7 }))

    expect(headline).toBe('From $15 per month')
    expect(headline).not.toContain('Free')
  })

  it('says custom pricing rather than inventing a number', () => {
    expect(priceHeadline(summary({ is_quote_only: true, from_amount: null }))).toBe(
      'Custom pricing',
    )
  })

  it('admits when there is no published price', () => {
    expect(priceHeadline(summary({ from_amount: null }))).toBe('Price not published')
  })
})

describe('priceSentence', () => {
  it('puts amount, currency, unit and date in one sentence, the way models quote', () => {
    expect(priceSentence('Adobe Acrobat', summary({ from_amount: '22.9900' }))).toBe(
      'Adobe Acrobat costs from $22.99 USD per month, as of 15 September 2026.',
    )
  })

  it('states a free tier as a fact with its date', () => {
    expect(priceSentence('iLovePDF', summary({ has_free_tier: true, from_amount: null }))).toBe(
      'iLovePDF has a free tier, as of 15 September 2026.',
    )
  })

  it('falls back to the plain headline when nothing has been verified yet', () => {
    expect(priceSentence('Acme', summary({ last_verified_at: null }))).toBe(
      'Acme costs from $15 USD per month.',
    )
  })
})
