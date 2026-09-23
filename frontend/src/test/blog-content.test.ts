import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { frontmatter } from 'fumadocs-core/content/md/frontmatter'
import { describe, expect, it } from 'vitest'

import { blogFrontmatterSchema } from '@/lib/blog/schema'

/**
 * The guard on `content/blog`.
 *
 * Like `docs-content.test.ts` it reads the files from disk rather than
 * importing `@/lib/blog/source`, a macro that throws outside the bundler. The
 * macro validates the same schema at build time; this catches it at test time,
 * along with what no schema can see - a banner that is not in `public/`.
 */
const BLOG = resolve(import.meta.dirname, '../../content/blog')
const PUBLIC = resolve(import.meta.dirname, '../../public')

const FILES = readdirSync(BLOG).filter((name) => name.endsWith('.mdx'))

const parse = (name: string) =>
  blogFrontmatterSchema.parse(frontmatter(readFileSync(join(BLOG, name), 'utf8')).data)

describe('the blog content folder', () => {
  it('has posts at all', () => {
    // A misconfigured `dir` in the macro yields an empty blog that builds and
    // deploys perfectly happily.
    expect(FILES.length).toBeGreaterThan(0)
  })

  it('holds only posts - no subfolders, which the flat slug scheme would not route', () => {
    const dirs = readdirSync(BLOG, { withFileTypes: true }).filter((entry) => entry.isDirectory())

    expect(dirs).toEqual([])
  })

  it.each(FILES)('names %s as a kebab-case slug', (name) => {
    expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/)
  })

  it.each(FILES)('gives %s valid frontmatter', (name) => {
    expect(() => parse(name)).not.toThrow()
  })

  it.each(FILES)('gives %s a description that fits a meta tag', (name) => {
    expect(parse(name).description.length).toBeLessThanOrEqual(200)
  })

  it.each(FILES)('dates any update to %s after its publication', (name) => {
    const { date, lastmod = date } = parse(name)

    expect(lastmod >= date).toBe(true)
  })

  it.each(FILES)('points %s at a banner that exists', (name) => {
    const { image } = parse(name)

    if (image) expect(existsSync(join(PUBLIC, image))).toBe(true)
  })

  it('gives every post its own title', () => {
    const titles = FILES.map((name) => parse(name).title)

    expect(new Set(titles).size).toBe(titles.length)
  })
})
