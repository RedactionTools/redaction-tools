import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createMDX } from 'fumadocs-mdx/next'

// Next infers a workspace root by walking up for lockfiles and would find the
// repo root (which also holds the backend); pin it so standalone tracing stays
// inside frontend/.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,

  /**
   * Served from the routes manifest, which the standalone `server.js` reads -
   * so this costs no render, unlike a route handler whose only job is to 308.
   */
  async redirects() {
    return [{ source: '/methodology', destination: '/docs/methodology', permanent: true }]
  },
}

/**
 * `.mjs`, not `.ts`, and not by preference: Next transpiles a TypeScript config
 * to CommonJS and `require()`s it, while `fumadocs-mdx/next` is ESM-only.
 *
 * `macro.include` is narrowed from the default, which covers every js/ts
 * extension: those globs become Turbopack rule keys, so the whole app would be
 * tested against a rule that exists for one module.
 */
const withMDX = createMDX({ macro: { include: ['**/source.ts'] } })

export default withMDX(nextConfig)
