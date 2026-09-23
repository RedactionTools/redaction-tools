import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PostMeta } from './post-meta'

describe('PostMeta', () => {
  it('dates the post in words, with a machine-readable date beside it', () => {
    render(<PostMeta date="2026-09-23" readingMinutes={4} />)

    expect(screen.getByText('23 September 2026')).toHaveAttribute('dateTime', '2026-09-23')
  })

  it('says how long it takes to read', () => {
    render(<PostMeta date="2026-09-23" readingMinutes={4} />)

    expect(screen.getByText('4 min read')).toBeInTheDocument()
  })

  it('says when it was last updated, if it was', () => {
    render(<PostMeta date="2026-09-23" lastmod="2026-10-01" readingMinutes={4} />)

    expect(screen.getByText(/Updated/)).toHaveTextContent('Updated 1 October 2026')
  })

  it('says nothing about updates when the post was never edited', () => {
    render(<PostMeta date="2026-09-23" readingMinutes={4} />)

    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
  })
})
