import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { makeTool } from './fixtures'
import { PREVIEW_COUNT, ToolPicker } from './tool-picker'

const NAMES = [
  'Adobe Acrobat',
  'Redactable',
  'Nitro PDF',
  'CaseGuard Studio',
  'Objective Redact',
  'PDFelement',
  'Smallpdf',
  'iLovePDF',
]

const TOOLS = NAMES.map((name) =>
  makeTool({
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    vendor: {
      slug: 'v',
      name: name === 'PDFelement' ? 'Wondershare' : `${name} Inc`,
      hq_country: 'US',
    },
  }),
)

function render(props: Partial<Parameters<typeof ToolPicker>[0]> = {}) {
  const onPick = vi.fn()
  renderWithProviders(
    <>
      <label htmlFor="picker">Tools</label>
      <ToolPicker id="picker" tools={TOOLS} placeholder="Search tools" onPick={onPick} {...props} />
    </>,
  )
  return { onPick, input: screen.getByRole('combobox', { name: 'Tools' }) }
}

function options() {
  return within(screen.getByRole('listbox', { name: 'Tools' }))
    .getAllByRole('option')
    .map((option) => option.textContent)
}

describe('ToolPicker', () => {
  it('keeps the list closed until the reader reaches for it', () => {
    render()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // Browsing rather than hunting: an empty box gives that reader nothing.
  it('previews the first tools, in catalog order, when focused', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.click(input)

    expect(options()).toHaveLength(PREVIEW_COUNT)
    expect(options()[0]).toContain('Adobe Acrobat')
    expect(screen.getByText(`Type to search all ${TOOLS.length} tools`)).toBeInTheDocument()
  })

  it('searches the whole catalog, not only the preview', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.type(input, 'ilove')

    expect(options()).toEqual([expect.stringContaining('iLovePDF')])
  })

  it('finds a tool by its vendor', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.type(input, 'wondershare')

    expect(options()).toEqual([expect.stringContaining('PDFelement')])
  })

  it('ranks names that start with the query above ones that only contain it', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.type(input, 'pdf')

    expect(options()[0]).toContain('PDFelement')
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.type(input, 'zzz')

    expect(screen.getByText('No tools match “zzz”')).toBeInTheDocument()
  })

  it('adds a tool from the keyboard', async () => {
    const user = userEvent.setup()
    const { input, onPick } = render()

    await user.type(input, 'pdf')
    await user.keyboard('{ArrowDown}{Enter}')

    // PDFelement leads; one step down is the first name merely containing "pdf".
    expect(onPick).toHaveBeenCalledWith('nitro-pdf')
    expect(input).toHaveValue('')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { input } = render()

    await user.click(input)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('offers nothing once the comparison is full', async () => {
    const user = userEvent.setup()
    const { input } = render({ disabled: true, placeholder: 'Up to 5 tools at a time' })

    await user.click(input)

    expect(input).toBeDisabled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
