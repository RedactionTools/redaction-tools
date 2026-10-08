import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { EmailSignIn } from './email-sign-in'

const signIn = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

function stubFetch(status: number, body: unknown = null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

afterEach(() => vi.restoreAllMocks())

async function requestCode(email = 'reader@example.com') {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
}

describe('EmailSignIn', () => {
  it('asks for a code and a link, carrying where to land afterwards', async () => {
    const spy = stubFetch(204)
    renderWithProviders(<EmailSignIn redirectTo="/tools/acme" />)

    await requestCode()

    expect(await screen.findByText(/sent a sign-in link and a code/i)).toHaveTextContent(
      'reader@example.com',
    )
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/auth/email-login')
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'reader@example.com',
      next: '/tools/acme',
    })
  })

  it('signs in with the typed code and lands where it was asked from', async () => {
    stubFetch(204)
    signIn.mockResolvedValue({ ok: true, error: undefined })
    renderWithProviders(<EmailSignIn redirectTo="/tools/acme" />)
    await requestCode()

    await userEvent.type(await screen.findByLabelText('Code'), '042917')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signIn).toHaveBeenCalledWith('email', {
      email: 'reader@example.com',
      code: '042917',
      redirect: false,
    })
    expect(replace).toHaveBeenCalledWith('/tools/acme')
  })

  it('says so when the code is wrong, and stays put', async () => {
    stubFetch(204)
    signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })
    renderWithProviders(<EmailSignIn redirectTo="/account" />)
    await requestCode()

    await userEvent.type(await screen.findByLabelText('Code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong or has expired/i)
    expect(replace).not.toHaveBeenCalled()
  })

  it('goes back to the address to fix a typo', async () => {
    stubFetch(204)
    renderWithProviders(<EmailSignIn redirectTo="/account" />)
    await requestCode('typo@example.con')

    await userEvent.click(await screen.findByRole('button', { name: 'Use a different email' }))

    expect(screen.getByLabelText('Email')).toHaveValue('typo@example.con')
  })
})
