/**
 * Where a sign-in lands: always a path on this site.
 *
 * `callbackUrl` and an email link's `next` are whatever the URL says. An
 * absolute URL keeps only its path - next-auth's own `signIn()` sends the
 * current page that way - so no input can send the reader to another site.
 */
const FALLBACK = '/account'

export function landingPath(value: unknown): string {
  if (typeof value !== 'string' || !value) return FALLBACK
  let path = value
  if (!value.startsWith('/')) {
    try {
      const url = new URL(value)
      path = `${url.pathname}${url.search}${url.hash}`
    } catch {
      return FALLBACK
    }
  }
  // `//host` and `/\host` are protocol-relative to a browser: another site.
  return /^\/[/\\]/.test(path) ? FALLBACK : path
}
