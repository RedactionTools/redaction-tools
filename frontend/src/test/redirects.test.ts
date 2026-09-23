import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The redirects Next serves from its routes manifest.
 *
 * Read as source text rather than imported, for the same reason
 * `proxy.matcher.test.ts` does: importing the config would execute
 * `createMDX()` and pull esbuild and a file watcher into jsdom to assert on
 * three string literals.
 */
const SOURCE = readFileSync(join(import.meta.dirname, '../../next.config.mjs'), 'utf8')

describe('the redirects', () => {
  /**
   * `/methodology` was a top-level page for the catalog's whole life: it is in
   * the header, the footer, inbound links and every sitemap we have served.
   * Moving it into the docs without a permanent redirect throws that away.
   */
  it('moves the methodology into the docs permanently', () => {
    expect(SOURCE).toMatch(/source:\s*'\/methodology'/)
    expect(SOURCE).toMatch(/destination:\s*'\/docs\/methodology'/)
    expect(SOURCE).toMatch(/permanent:\s*true/)
  })
})
