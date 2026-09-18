import { ApiError } from './api-error'

type FieldError = { loc?: unknown[]; msg?: string }

/**
 * Turn whatever the API refused with into something the reader can act on.
 *
 * Ninja reports validation failures as a list of per-field entries and business
 * conflicts as a `detail` string; flattening both to "something went wrong"
 * would hide the one message that tells a duplicate submitter to claim the
 * listing instead, or a claimant that they already hold a claim.
 *
 * Takes `unknown`: the Register augmentation types query errors as ApiError, but
 * a mutation's error is not covered by it, so this narrows rather than asserts.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback

  const body = error.body as { detail?: string | FieldError[] } | null
  const detail = body?.detail

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return (
      detail
        .map((entry) => {
          const field = Array.isArray(entry.loc) ? entry.loc.at(-1) : undefined
          return field ? `${field}: ${entry.msg}` : entry.msg
        })
        .filter(Boolean)
        .join(' ') || fallback
    )
  }
  return fallback
}
