import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { frontmatter } from 'fumadocs-core/content/md/frontmatter'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'
import { describe, expect, it } from 'vitest'

/**
 * The guard on `content/docs`.
 *
 * It reads the tree from disk rather than importing `@/lib/source`, which is a
 * macro that throws outside the bundler - see the note on that module.
 *
 * What it is really for is `meta.json`: when a folder lists `pages`, anything
 * absent from that list is dropped from the sidebar entirely. A page renamed
 * without updating its meta keeps rendering at its URL and silently stops being
 * reachable, which no other check would catch.
 */
const DOCS = resolve(import.meta.dirname, '../../content/docs')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

const FILES = walk(DOCS)
const PAGES = FILES.filter((file) => file.endsWith('.mdx'))
const METAS = FILES.filter((file) => file.endsWith('meta.json'))

/** Separators, external links and the wildcards fumadocs allows in `pages`. */
const NOT_A_PATH = /^(---.*---|\.\.\.|!.*|\[.*]\(.*\))$/

describe('the docs content tree', () => {
  it('has pages at all', () => {
    // A misconfigured `dir` yields an empty tree and a /docs that 404s
    // everywhere, which builds and deploys perfectly happily.
    expect(PAGES.length).toBeGreaterThan(0)
  })

  it.each(PAGES.map((file) => relative(DOCS, file)))('gives %s valid frontmatter', (name) => {
    const { data } = frontmatter(readFileSync(join(DOCS, name), 'utf8'))

    expect(() => pageSchema.parse(data)).not.toThrow()
  })

  it.each(PAGES.map((file) => relative(DOCS, file)))(
    'gives %s a description worth serving as a meta tag',
    (name) => {
      // `pageSchema` marks it optional, but `generateMetadata` feeds it straight
      // to <meta name="description">, and an absent one means the page competes
      // in search on whatever Google scrapes instead.
      const { data } = frontmatter(readFileSync(join(DOCS, name), 'utf8'))
      const { description } = pageSchema.parse(data)

      expect(description ?? '').not.toBe('')
      expect(description?.length ?? 0).toBeLessThanOrEqual(200)
    },
  )

  it.each(METAS.map((file) => relative(DOCS, file)))('gives %s a valid shape', (name) => {
    expect(() => metaSchema.parse(JSON.parse(readFileSync(join(DOCS, name), 'utf8')))).not.toThrow()
  })

  it.each(METAS.map((file) => relative(DOCS, file)))(
    'points every page %s lists at something real',
    (name) => {
      const dir = join(DOCS, name, '..')
      const { pages = [] } = metaSchema.parse(JSON.parse(readFileSync(join(DOCS, name), 'utf8')))

      const missing = pages
        .filter((page) => !NOT_A_PATH.test(page))
        .filter(
          (page) =>
            !FILES.includes(join(dir, `${page}.mdx`)) &&
            !FILES.some((file) => file.startsWith(join(dir, page) + '/')),
        )

      expect(missing).toEqual([])
    },
  )
})
