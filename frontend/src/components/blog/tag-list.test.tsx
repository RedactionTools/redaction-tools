import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TagList } from './tag-list'

describe('TagList', () => {
  it('links each tag to its archive', () => {
    render(<TagList tags={['Announcements', 'PDF redaction']} />)

    expect(screen.getByRole('link', { name: 'Announcements' })).toHaveAttribute(
      'href',
      '/blog/tags/announcements',
    )
    expect(screen.getByRole('link', { name: 'PDF redaction' })).toHaveAttribute(
      'href',
      '/blog/tags/pdf-redaction',
    )
  })

  it('renders nothing for an untagged post', () => {
    const { container } = render(<TagList tags={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
