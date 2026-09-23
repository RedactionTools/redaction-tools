import Image from 'next/image'
import Link from 'next/link'

import type { BlogPostMeta } from '@/lib/blog/posts'
import { cn } from '@/lib/utils'

import { PostMeta } from './post-meta'
import { TagList } from './tag-list'

/**
 * A post in a list. `featured` is the newest post on the first page: larger,
 * and an `h2` because it sits directly under the page's `h1` - the grid below
 * it is a section of its own, headed by an `h2`, so its cards are `h3`s.
 */
export function PostCard({ post, featured = false }: { post: BlogPostMeta; featured?: boolean }) {
  const Heading = featured ? 'h2' : 'h3'

  return (
    <article
      className={cn(
        'border-border bg-surface flex flex-col overflow-hidden rounded-(--radius-card) border',
        featured && 'md:flex-row',
      )}
    >
      {post.image ? (
        <div className={cn('relative aspect-[16/9] shrink-0', featured && 'md:w-1/2')}>
          {/* Decorative: the title beside it already names the link. */}
          <Image
            src={post.image}
            alt=""
            fill
            sizes={featured ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
            className="object-cover"
            priority={featured}
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <PostMeta date={post.date} readingMinutes={post.readingMinutes} />
        <Heading
          className={cn(
            'font-semibold tracking-tight text-balance',
            featured ? 'text-2xl md:text-3xl' : 'text-lg',
          )}
        >
          <Link href={post.url} className="hover:underline">
            {post.title}
          </Link>
        </Heading>
        <p className="text-muted-foreground text-pretty">{post.description}</p>
        <TagList tags={post.tags} className="mt-auto pt-2" />
      </div>
    </article>
  )
}
