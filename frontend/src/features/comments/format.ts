/** "1 October 2026", in UTC so the server render and the browser agree on the day. */
const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatCommentDate(iso: string): string {
  return DAY.format(new Date(iso))
}

/** The longest comment the API accepts (`COMMENTS_MAX_LENGTH`). */
export const MAX_LENGTH = 5000

export const STATUS_TONES = {
  published: 'ok',
  pending: 'neutral',
  rejected: 'warn',
  removed: 'warn',
} as const

export const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  pending: 'Awaiting review',
  rejected: 'Rejected',
  removed: 'Removed',
}
