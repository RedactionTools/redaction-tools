import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What the auth proxy runs on.
 *
 * Read out of the source rather than imported: `proxy.ts` re-exports next-auth's
 * `auth`, and importing it here would drag the whole framework into jsdom to
 * test a regular expression. Next compiles the matcher with path-to-regexp
 * rather than `new RegExp`, but for a pattern that is one negative lookahead
 * the two agree, and this catches every mistake anyone is realistically going
 * to make in it.
 */
const SOURCE = readFileSync(join(import.meta.dirname, 'proxy.ts'), 'utf8')

// Read as source text, so the escapes are still the TypeScript ones: `\\.` in
// the file is the two characters a string literal turns into one `\.`.
const PATTERN = SOURCE.match(/matcher: \[\s*'([^']+)'/)![1].replace(/\\\\/g, '\\')

const MATCHER = new RegExp(`^${PATTERN}$`)

/** Public, cacheable and read by machines - none of it needs a session. */
const SKIPPED = [
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/llms-full.txt',
  '/opengraph-image',
  '/tool/adobe-acrobat/opengraph-image-a1b2c3',
  '/icon.png',
  '/apple-icon.png',
  '/_next/static/chunk.js',
]

const GUARDED = ['/', '/account', '/my-listings', '/tool/adobe-acrobat', '/price-calculator']

describe('the proxy matcher', () => {
  it.each(SKIPPED)('leaves %s to Next', (path) => {
    expect(MATCHER.test(path)).toBe(false)
  })

  it.each(GUARDED)('still runs auth on %s', (path) => {
    expect(MATCHER.test(path)).toBe(true)
  })
})
