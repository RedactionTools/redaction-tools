import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { getGetCliLoginQueryKey } from '@/lib/api/generated/auth/auth'
import type { CliLoginOut } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { CliLoginApproval } from './cli-login-approval'

function makeLogin(overrides: Partial<CliLoginOut> = {}): CliLoginOut {
  return {
    user_code: 'BCDF-GHJK',
    client_name: 'mykola-laptop',
    status: 'pending',
    expires_at: '2026-09-25T13:30:00Z',
    ...overrides,
  }
}

function render(login: CliLoginOut | null = makeLogin(), code = 'BCDF-GHJK') {
  const queryClient = makeTestQueryClient()
  if (login) queryClient.setQueryData(getGetCliLoginQueryKey(code), login)
  return renderWithProviders(<CliLoginApproval code={code} />, { queryClient })
}

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(makeLogin({ status: 'approved' })), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CliLoginApproval', () => {
  it('shows the code and the machine, to compare with the terminal', () => {
    render()

    expect(screen.getByText('BCDF-GHJK')).toBeInTheDocument()
    expect(screen.getByText(/mykola-laptop/)).toBeInTheDocument()
  })

  it('approves the sign-in and sends the user back to the terminal', async () => {
    render()

    await userEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/auth/cli-logins/BCDF-GHJK/approve')
    expect(init?.method).toBe('POST')
    expect(await screen.findByText(/return to your terminal/i)).toBeInTheDocument()
  })

  it('denies a sign-in the user did not start', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(makeLogin({ status: 'denied' })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    render()

    await userEvent.click(screen.getByRole('button', { name: /deny/i }))

    await waitFor(() => expect(String(fetchSpy.mock.calls[0][0])).toContain('/deny'))
    expect(await screen.findByText(/denied/i)).toBeInTheDocument()
  })

  it('says an expired code is expired, with no buttons', () => {
    render(makeLogin({ status: 'expired' }))

    expect(screen.getByText(/expired/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
  })

  it('asks for the code when the link carried none', () => {
    render(null, '')

    expect(screen.getByLabelText(/code from your terminal/i)).toBeInTheDocument()
  })
})
