import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { makePost } from './fixtures'
import { PostList } from './post-list'

const posts = [
  makePost({ slug: 'newest', title: 'Newest' }),
  makePost({ slug: 'older', title: 'Older' }),
  makePost({ slug: 'oldest', title: 'Oldest' }),
]

describe('PostList', () => {
  it('features the first post and lists the rest under their own heading', () => {
    render(<PostList posts={posts} featureFirst basePath="/blog" page={1} totalPages={1} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Newest' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Earlier posts' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Older' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Oldest' })).toBeInTheDocument()
  })

  // Page 2 onwards has no "newest" to feature: it is an archive page.
  it('lists every post alike when nothing is featured', () => {
    render(<PostList posts={posts} basePath="/blog" page={2} totalPages={2} />)

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(screen.queryByRole('heading', { name: 'Earlier posts' })).not.toBeInTheDocument()
  })

  it('pages through the archive', () => {
    render(<PostList posts={posts} basePath="/blog" page={1} totalPages={2} />)

    expect(screen.getByRole('link', { name: 'Older posts' })).toHaveAttribute(
      'href',
      '/blog/page/2',
    )
  })

  it('says so when there is nothing to read yet', () => {
    render(<PostList posts={[]} featureFirst basePath="/blog" page={1} totalPages={1} />)

    expect(screen.getByText('No posts yet.')).toBeInTheDocument()
  })
})
