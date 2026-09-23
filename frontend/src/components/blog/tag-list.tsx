import Link from 'next/link'

import { tagSlug } from '@/lib/blog/posts'
import { cn } from '@/lib/utils'

export function TagList({ tags, className }: { tags: readonly string[]; className?: string }) {
  if (tags.length === 0) return null

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/blog/tags/${tagSlug(tag)}`}
            className="bg-muted text-muted-foreground hover:text-foreground inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  )
}
