import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from '@/components/layout/theme-toggle'

const setTheme = vi.fn()
const useTheme = vi.fn()

vi.mock('next-themes', () => ({ useTheme: () => useTheme() }))

/**
 * Opens the menu with the keyboard rather than a click - under jsdom only the
 * first pointer-driven open in a file succeeds, same as the account menu.
 */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole('button', { name: /theme/i })
  trigger.focus()
  await user.keyboard('{Enter}')
  return trigger
}

beforeEach(() => {
  useTheme.mockReturnValue({ theme: 'system', setTheme })
})

describe('ThemeToggle', () => {
  it('offers light, dark and the system setting', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await openMenu(user)

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument()
  })

  it('switches the theme when one is chosen', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await openMenu(user)
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  // Without this the menu lists the alternatives but never says where you are.
  it('marks the setting currently in force', async () => {
    useTheme.mockReturnValue({ theme: 'dark', setTheme })
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await openMenu(user)

    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toBeChecked()
    expect(screen.getByRole('menuitemradio', { name: 'System' })).not.toBeChecked()
  })

  /**
   * The trigger's glyph is swapped by CSS, not by `resolvedTheme`. next-themes
   * knows nothing until it hydrates, so a JS-picked icon renders the wrong one
   * on the server and visibly flips on first paint - the same reason the logo
   * ships both variants.
   */
  it('shows a sun on the light theme and a moon on the dark one, without JS', () => {
    useTheme.mockReturnValue({ theme: undefined, setTheme })
    const { container } = render(<ThemeToggle />)
    const [sun, moon] = Array.from(container.querySelectorAll('svg'))

    expect(sun.getAttribute('class')).toContain('dark:hidden')
    expect(moon.getAttribute('class')).toContain('hidden')
    expect(moon.getAttribute('class')).toContain('dark:block')
  })
})
