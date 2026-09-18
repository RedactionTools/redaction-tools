import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GitHubLink } from '@/components/layout/github-link'

describe('GitHubLink', () => {
  it('points at the project repository', () => {
    render(<GitHubLink />)

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/RedactionTools/redaction-tools',
    )
  })

  // Icon-only: without a label on the anchor the link announces as its URL.
  it('carries an accessible name, since there is no visible text', () => {
    render(<GitHubLink />)

    expect(screen.getByRole('link', { name: 'Project source on GitHub' })).toBeInTheDocument()
  })

  it('leaves the site in a new tab without handing over the opener', () => {
    render(<GitHubLink />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  /**
   * In the mobile drawer the mark sits in a column of worded links, where a
   * lone glyph reads as a stray mark rather than a destination.
   */
  it('can show its name where a mark alone would not read', () => {
    render(<GitHubLink label="Source on GitHub" />)

    expect(screen.getByRole('link')).toHaveTextContent('Source on GitHub')
  })

  // Two names on one link makes a screen reader say it twice.
  it('hides the mark itself from assistive tech', () => {
    const { container } = render(<GitHubLink />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
