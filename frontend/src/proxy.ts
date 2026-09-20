/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. A leftover `middleware.ts` is
 * silently ignored with no build error, so the old name must not come back.
 *
 * Running `auth` here matters: `auth()` called from a Server Component cannot
 * write cookies, so a token rotation during an RSC render would be computed and
 * never persisted. At the proxy layer there is a response to set it on.
 */
export { auth as proxy } from '@/auth'

/**
 * Everything but the files served to machines and caches.
 *
 * Skipping them is not only about the wasted JWT decode: `auth` can attach a
 * rotated-session `Set-Cookie` to the response, and putting one of those on a
 * year-cached public asset is how a session leaks into a shared cache.
 *
 * `.*opengraph-image` needs the leading `.*` because the lookahead is anchored
 * straight after the `/`, while the per-tool card lives at
 * `/tool/<slug>/opengraph-image-<hash>` - Next appends that hash because the
 * route's path contains the `(site)` group segment.
 *
 * `src/proxy.matcher.test.ts` holds this to the paths it has to let through.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png|robots\\.txt|sitemap\\.xml|llms\\.txt|llms-full\\.txt|.*opengraph-image).*)',
  ],
}
