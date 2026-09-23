import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Pagination } from './pagination'

describe('Pagination', () => {
  // Page 1 lives at the base path; `/page/1` redirects there, and linking a
  // redirect makes every reader pay for the hop.
  it('links page 1 to the base path itself', () => {
    render(<Pagination basePath="/blog" page={2} totalPages={3} />)

    expect(screen.getByRole('link', { name: 'Newer posts' })).toHaveAttribute('href', '/blog')
    expect(screen.getByRole('link', { name: 'Older posts' })).toHaveAttribute(
      'href',
      '/blog/page/3',
    )
  })

  it('says where the reader is', () => {
    render(<Pagination basePath="/blog" page={2} totalPages={3} />)

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('offers no newer posts from the first page, nor older from the last', () => {
    const { rerender } = render(<Pagination basePath="/blog" page={1} totalPages={2} />)
    expect(screen.queryByRole('link', { name: 'Newer posts' })).not.toBeInTheDocument()

    rerender(<Pagination basePath="/blog" page={2} totalPages={2} />)
    expect(screen.queryByRole('link', { name: 'Older posts' })).not.toBeInTheDocument()
  })

  it('renders nothing when everything fits on one page', () => {
    const { container } = render(<Pagination basePath="/blog" page={1} totalPages={1} />)

    expect(container).toBeEmptyDOMElement()
  })
})
