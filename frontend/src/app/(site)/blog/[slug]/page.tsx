import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { AuthorCard } from '@/components/blog/author-card'
import { PostMeta } from '@/components/blog/post-meta'
import { PostNav } from '@/components/blog/post-nav'
import { PostToc } from '@/components/blog/post-toc'
import { TagList } from '@/components/blog/tag-list'
import { getMDXComponents } from '@/components/mdx'
import { getAuthor } from '@/lib/blog/authors'
import { adjacentPosts } from '@/lib/blog/posts'
import { getPost, getPostMetas, getPosts } from '@/lib/blog/source'
import { clientEnv } from '@/lib/env'
import { canonicalMetadata } from '@/lib/seo/canonical'
import { blogPostingJsonLd, breadcrumbJsonLd, combineJsonLd, personJsonLd } from '@/lib/seo/json-ld'

import { BLOG_FEED } from '../blog-feeds'

/** Compiled into the bundle at build time; an unknown slug is a 404. */
export const dynamicParams = false

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const post = getPost((await props.params).slug)
  if (!post) notFound()

  const authors = post.authors.map((id) => getAuthor(id)?.name).filter((name) => name != null)

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: authors.map((name) => ({ name })),
    // Never spelled by hand: `openGraph` and `alternates` are both assigned
    // wholesale, so a page writing either would drop what this returns.
    ...canonicalMetadata(post.url, {
      hasRouteImage: true,
      feeds: [BLOG_FEED],
      article: {
        publishedTime: post.date,
        modifiedTime: post.lastmod ?? post.date,
        authors,
        tags: post.tags,
      },
    }),
  }
}

export default async function BlogPostPage(props: PageProps<'/blog/[slug]'>) {
  const post = getPost((await props.params).slug)
  if (!post) notFound()

  const site = clientEnv.NEXT_PUBLIC_SITE_URL
  const { prev, next } = adjacentPosts(getPostMetas(), post.slug)
  const MDX = post.body

  const jsonLd = combineJsonLd([
    blogPostingJsonLd(site, post),
    ...post.authors.flatMap((id) => {
      const author = getAuthor(id)
      return author ? [personJsonLd(site, id, author)] : []
    }),
    breadcrumbJsonLd(site, [
      { name: 'Redaction tools', url: `${site}/` },
      { name: 'Blog', url: `${site}/blog` },
      { name: post.title, url: `${site}${post.url}` },
    ]),
  ])

  return (
    <article className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="max-w-3xl space-y-4">
        <TagList tags={post.tags} />
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {post.title}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">{post.description}</p>
        <PostMeta date={post.date} lastmod={post.lastmod} readingMinutes={post.readingMinutes} />
        <div className="flex flex-wrap gap-6 pt-2">
          {post.authors.map((id) => (
            <AuthorCard key={id} authorId={id} />
          ))}
        </div>
      </header>

      {post.image ? (
        <div className="border-border relative aspect-[16/9] overflow-hidden rounded-(--radius-card) border">
          <Image
            src={post.image}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="prose max-w-3xl min-w-0">
          <MDX components={getMDXComponents()} />
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <PostToc toc={post.toc} />
          </div>
        </aside>
      </div>

      <PostNav prev={prev} next={next} />
    </article>
  )
}
