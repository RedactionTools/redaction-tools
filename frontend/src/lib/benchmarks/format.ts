import type { RateOut } from '@/lib/api/generated/model'

/** Everything the site badges a result with: how far its numbers can be trusted. */
export type Provenance = 'server' | 'verified' | 'unverified' | 'mismatch'
export type Role = 'staff' | 'owner' | 'community'
export type Tone = 'ok' | 'neutral' | 'warn'

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** A fraction as a percentage to one decimal place; a missing one as a dash. */
export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : percent.format(value)
}

/**
 * A rate, or a dash when it is undefined.
 *
 * Undefined is not zero: a case set with no distractors has no over-redaction rate
 * at all, and printing 0% would credit a tool for something nobody tested.
 */
export function formatRate(rate: RateOut): string {
  return formatPercent(rate.value)
}

/** The Wilson 95% interval, as the range a reader should hold the rate to. */
export function formatInterval(rate: RateOut): string {
  if (!rate.ci95) return ''
  const [low, high] = rate.ci95
  return `${(low * 100).toFixed(1)}–${(high * 100).toFixed(1)}%`
}

/** The one-line verdict pdfredeval's own report leads with. */
export function leakSentence(rate: RateOut): string {
  if (!rate.n) return 'No sensitive values were in scope.'
  return `Leaked ${rate.count} of ${rate.n} sensitive values (${formatRate(rate)}).`
}

const PROVENANCE: Record<Provenance, { label: string; tone: Tone }> = {
  server: { label: 'Scored by us', tone: 'ok' },
  verified: { label: 'Self-scored · verified', tone: 'ok' },
  unverified: { label: 'Self-scored', tone: 'neutral' },
  mismatch: { label: 'Disputed by our rescore', tone: 'warn' },
}

export function provenanceBadge(provenance: Provenance) {
  return PROVENANCE[provenance]
}

const ROLES: Record<Role, string> = {
  staff: 'Redaction Tools',
  owner: 'Tool owner',
  community: 'Community',
}

export function roleLabel(role: Role): string {
  return ROLES[role]
}

const SURFACES: Record<string, string> = { web: 'Web app', api: 'API', desktop: 'Desktop app' }

export function surfaceLabel(surface: string): string {
  return SURFACES[surface] ?? surface
}

/**
 * The case an uploaded file is the output of, read from its name.
 *
 * Tools name their output after the input more often than not - `redacted-<id>.pdf`,
 * `<id> (1).pdf` - so this saves the uploader matching dozens of files by hand.
 *
 * Ids are unpadded (`pii-detection-1`), so a match must end where the id's number
 * ends: `pii-detection-12.pdf` is not case 1. Among what remains the longest id wins.
 */
export function caseIdFromFilename(filename: string, caseIds: string[]): string | null {
  const matches = caseIds.filter((id) => containsId(filename, id))
  if (matches.length === 0) return null
  return matches.reduce((longest, id) => (id.length > longest.length ? id : longest))
}

/** `id` in `filename`, not as part of a longer name or number on either side. */
function containsId(filename: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![0-9])`).test(filename)
}
