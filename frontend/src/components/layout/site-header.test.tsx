import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SiteHeader } from '@/components/layout/site-header'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

describe('SiteHeader', () => {
  /**
   * Sticky positioning is CSS-only, so jsdom cannot scroll it: the classes are
   * the behaviour. All three matter together - without a background the page
   * shows through, and the stacking order is what keeps the header under the
   * account dropdown (z-50) and over the page body.
   */
  it('stays at the top of the viewport while the page scrolls', () => {
    render(<SiteHeader />)

    const header = screen.getByRole('banner')
    expect(header.className).toContain('sticky')
    expect(header.className).toContain('top-0')
    expect(header.className).toContain('bg-background')
    expect(header.className).toContain('z-40')
  })

  it('links to the price calculator', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Price calculator' })).toHaveAttribute(
      'href',
      '/price-calculator',
    )
  })
})
