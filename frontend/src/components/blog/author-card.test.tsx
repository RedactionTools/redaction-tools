import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AuthorCard } from './author-card'

describe('AuthorCard', () => {
  it('names the author and their role', () => {
    render(<AuthorCard authorId="mykola-melnyk" />)

    expect(screen.getByText('Mykola Melnyk')).toBeInTheDocument()
    expect(screen.getByText('Maintainer, Redaction Tools')).toBeInTheDocument()
  })

  it('renders nothing for an author nobody registered', () => {
    const { container } = render(<AuthorCard authorId="nobody" />)

    expect(container).toBeEmptyDOMElement()
  })
})
