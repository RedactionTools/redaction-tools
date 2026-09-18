import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SiteFooter } from '@/components/layout/site-footer'

describe('SiteFooter', () => {
  it('carries the brand mark back to the catalog', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: 'Redaction Tools' })).toHaveAttribute('href', '/')
  })

  // The mark is decorative here - the wordmark beside it is the link's name.
  it('renders the logo without adding a second name to the brand link', () => {
    const { container } = render(<SiteFooter />)

    const images = Array.from(container.querySelectorAll('img'))
    expect(images).toHaveLength(2)
    for (const img of images) expect(img.getAttribute('alt')).toBe('')
  })

  it('links to the subreddit', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: /r\/RedactionTools/ })).toHaveAttribute(
      'href',
      'https://www.reddit.com/r/RedactionTools/',
    )
  })

  it('links to the LinkedIn company page', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/redaction-tools/',
    )
  })

  it.each([/r\/RedactionTools/, /LinkedIn/])(
    'leaves the site in a new tab without handing over the opener: %s',
    (name) => {
      render(<SiteFooter />)

      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    },
  )

  // Hardcoding the year means the footer is wrong every January.
  it('dates the copyright to the year it renders in', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2031-02-01T00:00:00Z'))

    try {
      render(<SiteFooter />)
      expect(screen.getByText(/©\s*2031\s+Redaction Tools/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the existing navigation', () => {
    render(<SiteFooter />)

    expect(screen.getByRole('link', { name: 'All tools' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'How we verify prices' })).toHaveAttribute(
      'href',
      '/methodology',
    )
    expect(screen.getByRole('link', { name: 'Submit a tool' })).toHaveAttribute('href', '/submit')
    expect(screen.getByRole('link', { name: 'Your listings' })).toHaveAttribute(
      'href',
      '/my-listings',
    )
  })
})
