/**
 * Where a price came from, in three visually distinct treatments.
 *
 * Distinct glyphs rather than colour alone: colour fails for roughly 8% of male
 * readers and in the print and high-contrast paths, and provenance is exactly
 * the thing a reader must not have to guess at.
 *
 * "Not independently verified" on vendor-supplied figures is deliberate and
 * non-negotiable - it is the disclosure that makes accepting vendor input safe.
 * It lives here, outside the badge that used to own it, because `llms-full.txt`
 * states the same thing in prose and a disclosure with two wordings is a
 * disclosure that will eventually have one.
 */
export const PROVENANCE: Record<
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

/** How a figure was obtained, or null when nothing was recorded. */
export function provenanceLabel(source: string | null | undefined): string | null {
  return (source && PROVENANCE[source]?.label) || null
}
