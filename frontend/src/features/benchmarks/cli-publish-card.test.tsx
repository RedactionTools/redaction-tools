import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { CliPublishCard } from './cli-publish-card'

describe('CliPublishCard', () => {
  it('walks through signing in and publishing from the command line', () => {
    renderWithProviders(<CliPublishCard />)

    expect(screen.getByText('uv run pdfredeval login')).toBeInTheDocument()
    expect(screen.getByText(/uv run pdfredeval publish/)).toBeInTheDocument()
    expect(
      screen.getByText(/git clone https:\/\/github\.com\/RedactionTools\/pdf-redaction-benchmarks/),
    ).toBeInTheDocument()
  })

  it('copies a command', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderWithProviders(<CliPublishCard />)

    await user.click(screen.getByRole('button', { name: 'Copy: uv run pdfredeval login' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('uv run pdfredeval login'))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('links to the full guide, including keys for CI', () => {
    renderWithProviders(<CliPublishCard />)

    expect(screen.getByRole('link', { name: /full guide/i })).toHaveAttribute(
      'href',
      '/docs/benchmarks/publishing-from-the-cli',
    )
  })
})
