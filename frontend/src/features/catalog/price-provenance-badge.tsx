import { Badge } from '@/components/ui/badge'
import type { PriceSummaryOut } from '@/lib/api/generated/model'
import { PROVENANCE } from '@/lib/catalog/provenance'

export function PriceProvenanceBadge({
  summary,
  slug,
}: {
  summary: PriceSummaryOut
  slug: string
}) {
  if (!summary.source) return null
  const treatment = PROVENANCE[summary.source]
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
