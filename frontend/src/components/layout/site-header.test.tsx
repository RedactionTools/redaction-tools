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

  it('carries the theme control', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument()
  })

  it('links to the price calculator', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Price calculator' })).toHaveAttribute(
      'href',
      '/price-calculator',
    )
  })

  /**
   * CSS-only, so the classes are the behaviour. Below `md` these destinations
   * live in the drawer instead - and because the drawer mounts its contents
   * only while open, there is still exactly one of each in the document.
   */
  it('folds its destinations away on a phone', () => {
    render(<SiteHeader />)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.className).toContain('hidden')
    expect(nav.className).toContain('md:flex')
  })

  /**
   * Signing in and changing the theme stay one tap away at every width, rather
   * than going behind the hamburger with the destinations.
   */
  it('keeps the theme and account controls out of the folding nav', () => {
    render(<SiteHeader />)

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).not.toContainElement(screen.getByRole('button', { name: 'Theme' }))
    expect(nav).not.toContainElement(screen.getByRole('button', { name: 'Sign in' }))
  })

  it('offers the menu the folded destinations went into', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })
})
