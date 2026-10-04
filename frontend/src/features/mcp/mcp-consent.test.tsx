import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { getGetMcpAuthorizationQueryKey } from '@/lib/api/generated/auth/auth'
import type { McpAuthorizationOut, McpAuthorizationParams } from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { McpConsent } from './mcp-consent'

const params: McpAuthorizationParams = {
  client_id: 'cc',
  redirect_uri: 'http://localhost:51234/callback',
  response_type: 'code',
  code_challenge: 'x'.repeat(43),
  code_challenge_method: 'S256',
  resource: 'https://backend.redaction-tools.com/mcp',
  state: 'xyz',
}

function makeConsent(overrides: Partial<McpAuthorizationOut> = {}): McpAuthorizationOut {
  return {
    client_name: 'Claude Code',
    redirect_uri: 'http://localhost:51234/callback',
    redirect_host: 'localhost',
    redirect_is_local: true,
    server_title: 'Redaction Tools staff',
    resource: 'https://backend.redaction-tools.com/mcp',
    scope: '',
    redirect_url: null,
    ...overrides,
  }
}

function render(consent: McpAuthorizationOut | null = makeConsent()) {
  const navigate = vi.fn()
  const queryClient = makeTestQueryClient()
  if (consent) queryClient.setQueryData(getGetMcpAuthorizationQueryKey(params), consent)
  renderWithProviders(<McpConsent params={params} navigate={navigate} />, { queryClient })
  return navigate
}

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ redirect_url: 'http://localhost:51234/callback?code=abc' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('McpConsent', () => {
  it('names the client and where the code will go', () => {
    render()

    expect(screen.getByRole('heading', { name: /connect claude code/i })).toBeInTheDocument()
    expect(screen.getByText(/Redaction Tools staff/)).toBeInTheDocument()
    expect(screen.getByText(/this computer/i)).toBeInTheDocument()
  })

  it('allows, then hands the browser back to the client with the code', async () => {
    const navigate = render()

    await userEvent.click(screen.getByRole('button', { name: /allow/i }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('http://localhost:51234/callback?code=abc'),
    )
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/auth/mcp-authorizations')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ params, decision: 'allow' })
  })

  it('denies', async () => {
    render()

    await userEvent.click(screen.getByRole('button', { name: /deny/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).decision).toBe('deny')
  })

  it('sends a malformed request straight back to its client, with no buttons', async () => {
    const navigate = render(
      makeConsent({ redirect_url: 'http://localhost:51234/callback?error=x' }),
    )

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('http://localhost:51234/callback?error=x'),
    )
    expect(screen.queryByRole('button', { name: /allow/i })).toBeNull()
  })

  it('explains a request it cannot send back', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Unknown client_id.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    render(null)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown client_id.')
  })
})
