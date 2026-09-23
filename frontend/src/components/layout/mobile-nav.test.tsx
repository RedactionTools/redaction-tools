import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MobileNav } from '@/components/layout/mobile-nav'

describe('MobileNav', () => {
  /**
   * The drawer is the only way to reach these pages on a phone, so the test
   * that matters is that every header destination survives the move into it.
   */
  it('opens a menu holding every header destination', async () => {
    render(<MobileNav />)

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))

    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByRole('link', { name: 'Price calculator' })).toHaveAttribute(
      'href',
      '/price-calculator',
    )
    expect(within(drawer).getByRole('link', { name: 'Methodology' })).toHaveAttribute(
      'href',
      '/docs/methodology',
    )
    expect(within(drawer).getByRole('link', { name: 'Submit a tool' })).toHaveAttribute(
      'href',
      '/submit',
    )
    expect(within(drawer).getByRole('link', { name: 'Project source on GitHub' })).toBeVisible()
  })

  it('keeps the menu shut until it is asked for', () => {
    render(<MobileNav />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * Choosing a destination has to shut the drawer. Next navigates on the
   * client, so nothing unmounts on its own and the menu would otherwise stay
   * open over the page it just opened.
   */
  it('shuts when a destination is chosen', async () => {
    render(<MobileNav />)

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('link', { name: 'Methodology' }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /** CSS-only, so the class is the behaviour - see SiteHeader's own tests. */
  it('is offered only on narrow viewports', () => {
    render(<MobileNav />)

    expect(screen.getByRole('button', { name: 'Menu' }).className).toContain('md:hidden')
  })
})
