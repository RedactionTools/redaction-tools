/**
 * Reads a JWT's `exp` claim without verifying the signature.
 *
 * We deliberately do not verify: the backend does that on every request. All we
 * need to know here is when to stop using a token, so that the refresh happens
 * before a request can 401. Uses only atob/TextDecoder so it stays edge-safe -
 * `proxy.ts` runs on the edge runtime.
 *
 * Returns epoch milliseconds, or null when there is no readable numeric `exp`.
 */
export function readJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))

    if (typeof claims !== 'object' || claims === null) return null

    const exp = (claims as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}
