/**
 * Where the API mutator gets its bearer token from.
 *
 * This module deliberately imports NOTHING. The server bundle and the client
 * bundle each get their own instance, and each registers the source that suits
 * its runtime: `token-source.server.ts` (backed by `auth()`) and
 * `token-source.client.ts` (backed by `getSession()`). That keeps one generated
 * API client working in both Server and Client Components, which a module that
 * imported `@/auth` directly could never do - `next/headers` cannot be bundled
 * for the browser.
 */
export type TokenSource = () => string | null | Promise<string | null>

const noToken: TokenSource = () => null

let currentSource: TokenSource = noToken

export function setTokenSource(source: TokenSource): void {
  currentSource = source
}

export function resetTokenSource(): void {
  currentSource = noToken
}

export async function getAccessToken(): Promise<string | null> {
  return (await currentSource()) ?? null
}
