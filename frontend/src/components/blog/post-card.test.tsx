import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { makePost } from './fixtures'
import { PostCard } from './post-card'

describe('PostCard', () => {
  it('links the title to the post', () => {
    render(<PostCard post={makePost()} />)

    expect(screen.getByRole('link', { name: 'Introducing Redaction Tools' })).toHaveAttribute(
      'href',
      '/blog/introducing-redaction-tools',
    )
  })

  it('shows the summary, the date and the tags', () => {
    render(<PostCard post={makePost()} />)

    expect(screen.getByText(/prices you can trust/)).toBeInTheDocument()
    expect(screen.getByText('23 September 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument()
  })

  // The banner is decoration: the title beside it already names the link.
  it('shows the banner without announcing it twice', () => {
    const { container } = render(
      <PostCard post={makePost({ image: '/images/blog/introducing/banner.png' })} />,
    )

    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('heads a featured post one level up the page outline', () => {
    render(<PostCard post={makePost()} featured />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Introducing Redaction Tools',
    )
  })
})
