import Link from 'next/link'

import type { BlogPostMeta } from '@/lib/blog/posts'

/** The older and the newer post, at the foot of a post. */
export function PostNav({
  prev,
  next,
}: {
  prev: BlogPostMeta | undefined
  next: BlogPostMeta | undefined
}) {
  if (!prev && !next) return null

  return (
    <nav aria-label="More posts" className="border-border grid gap-4 border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.url} className="group space-y-1">
          <span className="text-muted-foreground block text-sm">← Older</span>
          <span className="block font-medium group-hover:underline">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.url} className="group space-y-1 sm:text-right">
          <span className="text-muted-foreground block text-sm">Newer →</span>
          <span className="block font-medium group-hover:underline">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  )
}
