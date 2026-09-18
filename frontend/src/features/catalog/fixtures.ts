import type {
  CatalogStatsOut,
  PlanOut,
  PriceOut,
  ToolDetailOut,
  ToolListItemOut,
  ToolPageOut,
} from '@/lib/api/generated/model'

/** Shared test data, shaped exactly like the API's own responses. */
export function makeTool(overrides: Partial<ToolListItemOut> = {}): ToolListItemOut {
  return {
    slug: 'adobe-acrobat',
    name: 'Adobe Acrobat',
    tagline: 'The incumbent PDF editor, with redaction behind a paid tier.',
    summary: 'Adobe Acrobat Pro includes search-and-redact at $22.99 per month.',
    logo_url: '/images/tools/adobe-acrobat.svg',
    is_first_party: false,
    vendor: { slug: 'adobe', name: 'Adobe', hq_country: 'US' },
    facet_slugs: ['pdf', 'desktop', 'manual-redaction'],
    price_summary: {
      has_free_tier: false,
      is_trial: true,
      trial_days: 7,
      is_quote_only: false,
      from_amount: '22.9900',
      currency: 'USD',
      unit: 'month',
      billing_period: 'monthly',
      source: 'manual',
      is_pinned: true,
      source_note: '',
      source_url: 'https://www.adobe.com/acrobat/pricing.html',
      last_verified_at: '2026-09-15T00:00:00Z',
      last_changed_at: null,
      is_stale: false,
    },
    ...overrides,
  }
}

/** One published price, defaulting to a plain monthly subscription fee. */
export function makePrice(overrides: Partial<PriceOut> = {}): PriceOut {
  return {
    amount: '15.0000',
    currency: 'USD',
    unit: 'month',
    billing_period: 'monthly',
    is_overage: false,
    source: 'manual',
    is_pinned: true,
    source_note: '',
    source_evidence_url: '',
    effective_from: '2026-09-15T00:00:00Z',
    ...overrides,
  }
}

/**
 * One plan, defaulting to a plain paid subscription.
 *
 * Kept out of `makeToolDetail`'s defaults on purpose: tests assert against the
 * two plans that fixture already returns, so a third would break them silently.
 */
export function makePlan(overrides: Partial<PlanOut> = {}): PlanOut {
  return {
    code: 'pro',
    name: 'Pro',
    tier_order: 1,
    is_free_tier: false,
    is_trial: false,
    trial_days: null,
    is_enterprise_quote: false,
    min_seats: 1,
    highlights: [],
    source_url: '',
    verified_at: null,
    prices: [makePrice()],
    limits: [],
    ...overrides,
  }
}

export function makePage(items: ToolListItemOut[]): ToolPageOut {
  return { count: items.length, items }
}

export function makeStats(overrides: Partial<CatalogStatsOut> = {}): CatalogStatsOut {
  return {
    tools: 7,
    with_free_tier: 3,
    media: ['pdf', 'image', 'video', 'audio', 'text'],
    cheapest_amount: '0.0000',
    dearest_amount: '279.0000',
    currency: 'USD',
    generated_at: '2026-09-17T00:00:00Z',
    ...overrides,
  }
}

export function makeToolDetail(overrides: Partial<ToolDetailOut> = {}): ToolDetailOut {
  return {
    ...makeTool(),
    website_url: 'https://www.adobe.com/acrobat.html',
    pricing_url: 'https://www.adobe.com/acrobat/pricing.html',
    docs_url: '',
    description_md: 'Acrobat is the reference implementation of PDF editing. '.repeat(10),
    vendor_copy_md: '',
    pros: ['Removes underlying content and metadata properly'],
    cons: ['No free tier'],
    faq: [],
    updated_at: '2026-09-17T00:00:00Z',
    plans: [
      {
        code: 'trial',
        name: 'Free trial',
        tier_order: 0,
        is_free_tier: false,
        is_trial: true,
        trial_days: 7,
        is_enterprise_quote: false,
        min_seats: 1,
        highlights: [],
        source_url: 'https://www.adobe.com/acrobat/pricing.html',
        verified_at: null,
        prices: [],
        limits: [],
      },
      {
        code: 'pro',
        name: 'Acrobat Pro',
        tier_order: 1,
        is_free_tier: false,
        is_trial: false,
        trial_days: null,
        is_enterprise_quote: false,
        min_seats: 1,
        highlights: ['Search and redact'],
        source_url: 'https://www.adobe.com/acrobat/pricing.html',
        verified_at: null,
        prices: [
          makePrice({
            amount: '22.9900',
            source_note: 'Seeded from an editor-vetted comparison table.',
          }),
        ],
        limits: [],
      },
    ],
    ...overrides,
  }
}
