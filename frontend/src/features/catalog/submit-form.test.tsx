import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { SubmitForm } from './submit-form'

function stubFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/tool name/i), 'Acme Redact')
  await userEvent.type(screen.getByLabelText(/homepage/i), 'https://acme.example')
  await userEvent.type(screen.getByLabelText(/what it does/i), 'It redacts things.')
  await userEvent.click(screen.getByRole('button', { name: /submit/i }))
}

describe('SubmitForm', () => {
  it('sends what the submitter typed to the review queue', async () => {
    const fetchSpy = stubFetch(201, { id: 1, name: 'Acme Redact', status: 'submitted' })
    renderWithProviders(<SubmitForm />)

    await fillAndSubmit()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/api/v1/catalog/submissions')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: 'Acme Redact',
      homepage_url: 'https://acme.example',
      description: 'It redacts things.',
    })
  })

  it('says a submission is queued for review, not published', async () => {
    stubFetch(201, { id: 1, name: 'Acme Redact', status: 'submitted' })
    renderWithProviders(<SubmitForm />)

    await fillAndSubmit()

    expect(await screen.findByText(/review/i)).toBeInTheDocument()
  })

  it('passes the API conflict message straight through', async () => {
    // The API tells a duplicate submitter to claim the listing instead; losing
    // that message would leave them with a dead end.
    stubFetch(409, {
      detail: 'We already list that site as Adobe Acrobat (/tool/adobe-acrobat).',
    })
    renderWithProviders(<SubmitForm />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(/already list that site/i)
  })

  it('reports a rejected URL against the field rather than as a generic error', async () => {
    stubFetch(422, {
      detail: [
        { type: 'value_error', loc: ['body', 'homepage_url'], msg: 'That host is not allowed.' },
      ],
    })
    renderWithProviders(<SubmitForm />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(/host is not allowed/i)
  })
})
