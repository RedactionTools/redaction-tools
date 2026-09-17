import { Badge } from '@/components/ui/badge'
import type { PriceSummaryOut } from '@/lib/api/generated/model'

/**
 * Where a price came from, in three visually distinct treatments.
 *
 * Distinct glyphs rather than colour alone: colour fails for roughly 8% of male
 * readers and in the print and high-contrast paths, and provenance is exactly
 * the thing a reader must not have to guess at.
 *
 * "Not independently verified" on vendor-supplied figures is deliberate and
 * non-negotiable - it is the disclosure that makes accepting vendor input safe.
 */
const TREATMENTS: Record<
  string,
  { glyph: string; label: string; tone: 'ok' | 'neutral' | 'warn' }
> = {
  crawler: { glyph: '⟳', label: 'Read automatically from the vendor', tone: 'ok' },
  manual: { glyph: '✎', label: 'Entered by our editors', tone: 'neutral' },
  vendor: {
    glyph: '🏷',
    label: 'Supplied by the vendor, not independently verified',
    tone: 'warn',
  },
}

export function PriceProvenanceBadge({
  summary,
  slug,
}: {
  summary: PriceSummaryOut
  slug: string
}) {
  if (!summary.source) return null
  const treatment = TREATMENTS[summary.source]
  if (!treatment) return null

  const verified = summary.last_verified_at
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(summary.last_verified_at),
      )
    : null

  return (
    <Badge
      tone={treatment.tone}
      data-testid={`provenance-${slug}`}
      aria-label={verified ? `${treatment.label} on ${verified}` : treatment.label}
      title={verified ? `${treatment.label} on ${verified}` : treatment.label}
    >
      <span aria-hidden="true">{treatment.glyph}</span>
    </Badge>
  )
}
