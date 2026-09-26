import type {
  CatalogStatsOut,
  MyListingOut,
  PlanOut,
  PriceOut,
  StaffToolOut,
  ToolDetailOut,
  ToolListItemOut,
  ToolPageOut,
  ToolScreenshotOut,
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

/** A listing as its owner sees it: every field they may propose a change to. */
export function makeListing(overrides: Partial<MyListingOut> = {}): MyListingOut {
  return {
    slug: 'adobe-acrobat',
    status: 'published',
    name: 'Adobe Acrobat',
    tagline: 'The incumbent PDF editor.',
    summary: 'Acrobat Pro includes search-and-redact.',
    website_url: 'https://www.adobe.com/acrobat.html',
    pricing_url: 'https://www.adobe.com/acrobat/pricing.html',
    docs_url: '',
    logo_url: '/images/tools/adobe-acrobat.svg',
    vendor_copy_md: '',
    facet_slugs: ['manual-redaction', 'pdf'],
    ...overrides,
  }
}

/** One published screenshot, in the shape the profile renders. */
export function makeScreenshot(overrides: Partial<ToolScreenshotOut> = {}): ToolScreenshotOut {
  return {
    url: 'http://localhost:8007/media/screenshots/abc123/w960.webp',
    srcset:
      'http://localhost:8007/media/screenshots/abc123/w480.webp 480w, ' +
      'http://localhost:8007/media/screenshots/abc123/w960.webp 960w, ' +
      'http://localhost:8007/media/screenshots/abc123/w1440.webp 1440w',
    width: 1600,
    height: 900,
    alt: 'The Acrobat redaction panel with two marks applied',
    caption: 'Marking text for redaction',
    captured_at: '2026-09-01',
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
    // Mirrors the API's own order - the taxonomy's, not the database's.
    facets: [
      { dimension: 'media', dimension_label: 'Media', slug: 'pdf', label: 'PDF' },
      {
        dimension: 'capability',
        dimension_label: 'Capability',
        slug: 'ocr',
        label: 'OCR',
      },
      {
        dimension: 'capability',
        dimension_label: 'Capability',
        slug: 'true-removal',
        label: 'True content removal',
      },
    ],
    // Empty by default: most tests are about prices and editorial, and a
    // gallery every one of them had to account for would be noise.
    screenshots: [],
    benchmarks: [],
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

/** The staff record: the editable fields, plus what the public page never shows. */
export function makeStaffTool(overrides: Partial<StaffToolOut> = {}): StaffToolOut {
  const tool = makeToolDetail()
  return {
    slug: tool.slug,
    name: tool.name,
    vendor: tool.vendor.name,
    status: 'published',
    website_url: tool.website_url,
    pricing_url: tool.pricing_url,
    docs_url: tool.docs_url,
    logo_url: tool.logo_url,
    is_first_party: tool.is_first_party,
    tagline: tool.tagline,
    summary: tool.summary,
    description_md: tool.description_md,
    vendor_copy_md: tool.vendor_copy_md,
    pros: tool.pros,
    cons: tool.cons,
    faq: tool.faq,
    editor_verdict: '',
    editor_notes: '',
    sort_order: 0,
    last_verified_at: '2026-09-15T00:00:00Z',
    prices_changed_at: null,
    facets: [
      { dimension: 'media', value: 'pdf', slug: 'pdf', evidence_url: '', verified_at: null },
      { dimension: 'capability', value: 'ocr', slug: 'ocr', evidence_url: '', verified_at: null },
      {
        dimension: 'capability',
        value: 'true-removal',
        slug: 'true-removal',
        evidence_url: '',
        verified_at: null,
      },
    ],
    plans: tool.plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      tier_order: plan.tier_order,
      is_public: true,
      is_free_tier: plan.is_free_tier,
      is_trial: plan.is_trial,
      trial_days: plan.trial_days,
      is_enterprise_quote: plan.is_enterprise_quote,
      min_seats: plan.min_seats,
      highlights: plan.highlights,
      source_url: plan.source_url,
      prices: plan.prices.map((price) => ({
        amount: price.amount,
        currency: price.currency,
        unit: price.unit,
        billing_period: price.billing_period,
        is_overage: price.is_overage,
        source: price.source,
        source_note: price.source_note,
      })),
      limits: [],
    })),
    open_revisions: 0,
    open_price_proposals: 0,
    listable: true,
    listability_reasons: [],
    ...overrides,
  }
}
