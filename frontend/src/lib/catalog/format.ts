import type { PriceSummaryOut } from '@/lib/api/generated/model'

const UNIT_LABELS: Record<string, string> = {
  month: 'per month',
  year: 'per year',
  seat_month: 'per seat per month',
  seat_year: 'per seat per year',
  page: 'per page',
  document: 'per document',
  minute: 'per minute',
  credit: 'per credit',
  one_time: 'one-time',
}

/**
 * Money, at the precision the figure actually carries.
 *
 * Amounts are stored with four decimal places so per-page pricing survives, but
 * `$15.0000` reads like a machine wrote it - so trailing zeroes go, and $0.05
 * keeps the precision it needs.
 */
export function formatAmount(amount: string, currency: string): string {
  const value = Number(amount)
  const decimals = Math.min(4, Math.max(0, (amount.split('.')[1] ?? '').replace(/0+$/, '').length))
  // en-US renders USD as $15 rather than en-GB's US$15, while still giving €14.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatUnit(unit: string): string {
  return UNIT_LABELS[unit] ?? `per ${unit.replace(/_/g, ' ')}`
}

function entryPrice(summary: PriceSummaryOut): string | null {
  if (!summary.from_amount || !summary.currency || !summary.unit) return null
  if (Number(summary.from_amount) === 0) return null
  return `${formatAmount(summary.from_amount, summary.currency)} ${formatUnit(summary.unit)}`
}

/**
 * The price a table cell shows.
 *
 * A trial is never rendered as "Free": that conflation is the single most
 * common way a comparison table misleads, and the free-tier facet depends on
 * the distinction holding.
 */
export function priceHeadline(summary: PriceSummaryOut): string {
  const entry = entryPrice(summary)

  if (summary.has_free_tier) return entry ? `Free, or from ${entry}` : 'Free'
  if (entry) return `From ${entry}`
  if (summary.is_quote_only) return 'Custom pricing'
  return 'Price not published'
}

function verifiedOn(summary: PriceSummaryOut): string | null {
  if (!summary.last_verified_at) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(summary.last_verified_at))
}

/**
 * One self-contained sentence carrying amount, currency, unit and date.
 *
 * Language models lift sentences, not table cells, so the same facts are stated
 * in prose beside every table rather than only inside it.
 */
export function priceSentence(name: string, summary: PriceSummaryOut): string {
  const date = verifiedOn(summary)
  const suffix = date ? `, as of ${date}.` : '.'

  if (summary.has_free_tier && !summary.from_amount) {
    return `${name} has a free tier${suffix}`
  }
  if (summary.is_quote_only && !summary.from_amount) {
    return `${name} is priced on request${suffix}`
  }
  if (!summary.from_amount || !summary.currency || !summary.unit) {
    return `${name} does not publish a price${suffix}`
  }

  const amount = formatAmount(summary.from_amount, summary.currency)
  return `${name} costs from ${amount} ${summary.currency} ${formatUnit(summary.unit)}${suffix}`
}
