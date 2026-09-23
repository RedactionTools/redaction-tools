import type { TOCItemType } from 'fumadocs-core/toc'

import { cn } from '@/lib/utils'

/**
 * The post's sections, from the TOC fumadocs extracts at compile time. Two
 * levels only: an h4 in a sidebar is noise.
 */
export function PostToc({ toc }: { toc: readonly Pick<TOCItemType, 'title' | 'url' | 'depth'>[] }) {
  const items = toc.filter((item) => item.depth <= 3)
  if (items.length < 2) return null

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 font-medium">On this page</p>
      <ul className="border-border space-y-2 border-l">
        {items.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              className={cn(
                'text-muted-foreground hover:text-foreground -ml-px block border-l border-transparent pl-3 hover:border-current',
                item.depth === 3 && 'pl-6',
              )}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
