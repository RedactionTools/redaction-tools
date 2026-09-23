import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'

/**
 * The docs content tree.
 *
 * `defineDocs` is a macro: the bundler plugin rewrites this call into static
 * imports of every compiled MDX file, which is what lets the standalone image
 * serve /docs without `content/` on disk. Run outside the bundler it throws
 * `[MDX] this macro was not compiled by the bundler plugin` - so **nothing with
 * a vitest test may import this module**, directly or transitively. That is why
 * `buildSitemapEntries` and `buildLlmsTxt` take docs URLs as a parameter rather
 * than reading them from here.
 *
 * `dir` resolves against the working directory (frontend/), not this file.
 */
const docs = defineDocs({ dir: 'content/docs' })

export const source = loader({ baseUrl: '/docs', source: docs.toFumadocsSource() })
