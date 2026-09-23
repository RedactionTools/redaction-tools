import { z } from 'zod'

import { DEFAULT_AUTHOR, isAuthorId } from './authors'

/**
 * A post's frontmatter, as the macro in `./source.ts` validates it at build time
 * and `src/test/blog-content.test.ts` validates it on every test run.
 *
 * Kept apart from `./source.ts` so both can import it: that module is a macro
 * that throws outside the bundler.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * `YYYY-MM-DD`, however the YAML spelled it. An unquoted `date: 2026-09-23` is
 * parsed into a Date at midnight UTC, so its UTC day is the day that was typed.
 */
const day = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z
    .string()
    .regex(ISO_DAY, 'use YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'not a real date'),
)

export const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: day,
  lastmod: day.optional(),
  draft: z.boolean().default(false),
  tags: z.array(z.string().min(1)).default([]),
  authors: z
    .array(z.string().refine(isAuthorId, 'not in src/lib/blog/authors.ts'))
    .min(1)
    .default([DEFAULT_AUTHOR]),
  /** A banner under `public/images/blog/`; without one the generated card is used. */
  image: z
    .string()
    .regex(/^\/images\/blog\//, 'banners live under /images/blog/')
    .optional(),
  keywords: z.array(z.string()).optional(),
})

export type BlogFrontmatter = z.output<typeof blogFrontmatterSchema>
