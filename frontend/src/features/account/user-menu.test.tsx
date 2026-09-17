import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserMenu } from '@/features/account/user-menu'

const useSession = vi.fn()
const signIn = vi.fn()
const signOut = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: () => useSession(),
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}))

/**
 * Opens the menu with the keyboard rather than a click.
 *
 * Under jsdom only the first pointer-driven open in a file succeeds - every
 * later one leaves the trigger at aria-expanded="false" regardless of
 * userEvent.setup() or Radix's modal setting. Keyboard activation is reliable,
 * and doubles as a check that the menu is keyboard accessible.
 */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole('button', { name: /account menu/i })
  trigger.focus()
  await user.keyboard('{Enter}')
  return trigger
}

const session = {
  user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null },
  expires: '2099-01-01',
}

beforeEach(() => {
  useSession.mockReturnValue({ data: null, status: 'loading' })
})

describe('UserMenu when signed out', () => {
  it('shows a sign-in button', async () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(<UserMenu />)

    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(signIn).toHaveBeenCalledWith('google')
  })

  it('treats a session carrying a token error as signed out', () => {
    useSession.mockReturnValue({
      data: { ...session, error: 'RefreshTokenError' },
      status: 'authenticated',
    })
    render(<UserMenu />)

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

describe('UserMenu when signed in', () => {
  beforeEach(() => {
    useSession.mockReturnValue({ data: session, status: 'authenticated' })
  })

  it('collapses to an avatar trigger rather than inline links', () => {
    render(<UserMenu />)

    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument()
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument()
  })

  it('falls back to the initials when there is no profile picture', () => {
    render(<UserMenu />)

    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('reveals the username and email once opened', async () => {
    const user = userEvent.setup()
    render(<UserMenu />)

    await openMenu(user)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('signs out from the menu', async () => {
    const user = userEvent.setup()
    render(<UserMenu />)

    await openMenu(user)
    // Opening focuses "Account"; arrow down to "Sign out" and activate it.
    await screen.findByRole('menuitem', { name: /sign out/i })
    await user.keyboard('{ArrowDown}{Enter}')

    expect(signOut).toHaveBeenCalled()
  })
})

describe('UserMenu while loading', () => {
  it('shows a placeholder so the header does not jump', () => {
    render(<UserMenu />)

    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })
})
