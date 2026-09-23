import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { makePost } from './fixtures'
import { PostNav } from './post-nav'

describe('PostNav', () => {
  const older = makePost({ slug: 'older', title: 'An older post' })
  const newer = makePost({ slug: 'newer', title: 'A newer post' })

  it('links the older and the newer post by title', () => {
    render(<PostNav prev={older} next={newer} />)

    expect(screen.getByRole('link', { name: /An older post/ })).toHaveAttribute(
      'href',
      '/blog/older',
    )
    expect(screen.getByRole('link', { name: /A newer post/ })).toHaveAttribute(
      'href',
      '/blog/newer',
    )
  })

  it('renders nothing for the only post', () => {
    const { container } = render(<PostNav prev={undefined} next={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })
})
