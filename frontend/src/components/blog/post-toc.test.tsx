import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PostToc } from './post-toc'

describe('PostToc', () => {
  const toc = [
    { title: 'Why a catalog', url: '#why-a-catalog', depth: 2 },
    { title: 'How prices are checked', url: '#how-prices-are-checked', depth: 3 },
    { title: 'Too deep', url: '#too-deep', depth: 4 },
  ]

  it('links each section heading', () => {
    render(<PostToc toc={toc} />)

    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Why a catalog' })).toHaveAttribute(
      'href',
      '#why-a-catalog',
    )
    expect(screen.getByRole('link', { name: 'How prices are checked' })).toBeInTheDocument()
  })

  it('stops at the third heading level', () => {
    render(<PostToc toc={toc} />)

    expect(screen.queryByRole('link', { name: 'Too deep' })).not.toBeInTheDocument()
  })

  // One heading is not a table of contents.
  it('renders nothing for a post with fewer than two sections', () => {
    const { container } = render(<PostToc toc={toc.slice(0, 1)} />)

    expect(container).toBeEmptyDOMElement()
  })
})
