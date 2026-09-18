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

  // Two names on one link makes a screen reader say it twice.
  it('hides the mark itself from assistive tech', () => {
    const { container } = render(<GitHubLink />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
