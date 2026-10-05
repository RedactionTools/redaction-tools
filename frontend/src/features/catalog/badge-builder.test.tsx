import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getGetToolBadgesQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ToolBadgesOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { BadgeBuilder } from './badge-builder'
import { makeBadges } from './fixtures'

const SLUG = 'adobe-acrobat'

function render(badges: ToolBadgesOut = makeBadges()) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getGetToolBadgesQueryKey(SLUG), badges)
  return renderWithProviders(<BadgeBuilder slug={SLUG} name="Adobe Acrobat" />, { queryClient })
}

function snippet() {
  return screen.getByTestId('badge-snippet').textContent ?? ''
}

describe('BadgeBuilder', () => {
  it('hands over a linked badge for the listing, ready to paste', () => {
    render()

    expect(snippet()).toMatch(
      /^<a href="http:\/\/localhost:3007\/tool\/adobe-acrobat\?utm_source=badge"><img src="http:\/\/localhost:3007\/badge\/adobe-acrobat\/listed\.svg"/,
    )
    expect(screen.getAllByRole('img', { name: /listed on redaction tools/i })).toHaveLength(2)
  })

  it('offers only the badges the listing has earned, and says what the others need', () => {
    render(makeBadges({ benchmarked: true }))

    expect(screen.getByRole('radio', { name: /^reviewed/i })).toBeDisabled()
    expect(screen.getByText('Not yet reviewed by our editors.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^benchmarked/i })).toBeEnabled()
  })

  it('rewrites the snippet as the badge, theme and format change', async () => {
    const user = userEvent.setup()
    render(makeBadges({ benchmarked: true }))

    await user.click(screen.getByRole('radio', { name: /^benchmarked/i }))
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByRole('radio', { name: 'Markdown' }))

    expect(snippet()).toBe(
      '[![Benchmarked by Redaction Tools](http://localhost:3007/badge/adobe-acrobat/benchmarked.svg?theme=dark)](http://localhost:3007/tool/adobe-acrobat?utm_source=badge)',
    )
  })

  it('takes a custom colour, and will not hand over code for one that is not a colour', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('checkbox', { name: /custom colour/i }))
    const hex = screen.getByRole('textbox', { name: /hex/i })
    await user.clear(hex)
    await user.type(hex, '#ff9900')
    expect(snippet()).toContain('listed.svg?color=ff9900')

    await user.clear(hex)
    await user.type(hex, 'orange')
    expect(screen.getByRole('button', { name: 'Copy badge code' })).toBeDisabled()
    expect(screen.getByText(/six hex digits/i)).toBeInTheDocument()
  })

  it('offers the snippet as HTML or Markdown, never a bare image that links nowhere', () => {
    render()

    const formats = screen.getByRole('group', { name: 'Format' })
    expect(
      [...formats.querySelectorAll('input[type=radio]')].map((radio) =>
        radio.getAttribute('value'),
      ),
    ).toEqual(['html', 'markdown'])
  })

  it('warns when a custom colour would be hard to read on a white page', async () => {
    const user = userEvent.setup()
    render()

    await user.click(screen.getByRole('checkbox', { name: /custom colour/i }))
    const hex = screen.getByRole('textbox', { name: /hex/i })
    await user.clear(hex)
    await user.type(hex, '#ffcc00')

    expect(screen.getByText(/hard to read on a light background/i)).toBeInTheDocument()
    // A warning, not a refusal: the owner's site may be dark.
    expect(screen.getByRole('button', { name: 'Copy badge code' })).toBeEnabled()
  })

  it('copies the snippet', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render()

    await user.click(screen.getByRole('button', { name: 'Copy badge code' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(snippet()))
  })

  it('says badges come with publication when the listing has earned none', () => {
    render(makeBadges({ listed: false }))

    expect(screen.getByText(/once your listing is published/i)).toBeInTheDocument()
    expect(screen.queryByTestId('badge-snippet')).not.toBeInTheDocument()
  })
})
