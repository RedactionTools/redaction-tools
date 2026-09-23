import type { BlogPostMeta } from '@/lib/blog/posts'

import { Pagination } from './pagination'
import { PostCard } from './post-card'

/**
 * A page of posts. `featureFirst` is for the first page of the blog, where the
 * newest post leads at full width; archive and tag pages list everything alike.
 */
export function PostList({
  posts,
  featureFirst = false,
  basePath,
  page,
  totalPages,
}: {
  posts: readonly BlogPostMeta[]
  featureFirst?: boolean
  basePath: string
  page: number
  totalPages: number
}) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">No posts yet.</p>
  }

  const lead = featureFirst ? posts[0] : undefined
  const rest = featureFirst ? posts.slice(1) : posts

  return (
    <div className="space-y-10">
      {lead ? <PostCard post={lead} featured /> : null}
      {rest.length ? (
        <section className="space-y-4">
          {lead ? <h2 className="text-lg font-semibold tracking-tight">Earlier posts</h2> : null}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : null}
      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
    </div>
  )
}
