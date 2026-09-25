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

  it('links to the benchmarks', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Benchmarks' })).toHaveAttribute('href', '/benchmarks')
  })

  it('links to the blog', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')
  })

  /**
   * The methodology moved into the docs. The header keeps naming it rather than
   * a generic "Docs": it is the page the catalog's credibility rests on, and a
   * reader who follows it lands in the docs shell with the sidebar anyway.
   */
  it('links to the methodology in its new home', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute(
      'href',
      '/docs/methodology',
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

  /**
   * The docs need a search trigger in the header, but the header is rendered on
   * every page and must not import fumadocs to get one - hence a slot rather
   * than a `showSearch` flag. It sits outside the folding nav, beside the other
   * always-visible controls.
   */
  it('renders the controls a route hands it, outside the folding nav', () => {
    render(<SiteHeader actions={<button type="button">Search docs</button>} />)

    const action = screen.getByRole('button', { name: 'Search docs' })
    expect(action).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toContainElement(action)
  })

  it('offers the menu the folded destinations went into', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })
})
