/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. A leftover `middleware.ts` is
 * silently ignored with no build error, so the old name must not come back.
 *
 * Running `auth` here matters: `auth()` called from a Server Component cannot
 * write cookies, so a token rotation during an RSC render would be computed and
 * never persisted. At the proxy layer there is a response to set it on.
 */
export { auth as proxy } from '@/auth'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
