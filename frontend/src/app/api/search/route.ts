import { createFromSource } from 'fumadocs-core/search/server'

import { source } from '@/lib/source'

/**
 * The docs search index, built once in module scope from the `structuredData`
 * that was compiled into the bundle. No filesystem read and no backend call, so
 * it works in the API-down image the same as it does locally.
 */
export const { GET } = createFromSource(source, { language: 'english' })
