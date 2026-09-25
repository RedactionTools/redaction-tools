import { Badge } from '@/components/ui/badge'
import { provenanceBadge, type Provenance } from '@/lib/benchmarks/format'

/** How far a result's numbers can be trusted - scored by us, or by the submitter and
 * then checked. Beside every figure, so a self-scored claim never reads as ours. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { label, tone } = provenanceBadge(provenance)
  return <Badge tone={tone}>{label}</Badge>
}
