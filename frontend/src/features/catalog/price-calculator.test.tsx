import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGetToolQueryKey, getListToolsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makePage, makePlan, makePrice, makeTool, makeToolDetail } from './fixtures'
import { PriceCalculator } from './price-calculator'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/price-calculator',
}))

const TOOLS = [
  makeTool({ slug: 'adobe-acrobat', name: 'Adobe Acrobat' }),
  makeTool({ slug: 'redactable', name: 'Redactable' }),
]

function redactable(): ToolDetailOut {
  return makeToolDetail({
    slug: 'redactable',
    name: 'Redactable',
    plans: [
      makePlan({
        code: 'payg',
        name: 'Pay per document',
        prices: [makePrice({ amount: '1.0000', unit: 'document', billing_period: 'usage' })],
      }),
    ],
  })
}

function acrobat(): ToolDetailOut {
  return makeToolDetail({
    slug: 'adobe-acrobat',
    name: 'Adobe Acrobat',
    plans: [makePlan({ code: 'pro', name: 'Acrobat Pro', prices: [makePrice()] })],
  })
}

function render(...slugs: string[]) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListToolsQueryKey({ page_size: 100 }), makePage(TOOLS))
  queryClient.setQueryData(getGetToolQueryKey('redactable'), redactable())
  queryClient.setQueryData(getGetToolQueryKey('adobe-acrobat'), acrobat())
  return renderWithProviders(<PriceCalculator slugs={slugs} />, { queryClient })
}

beforeEach(() => replace.mockClear())

describe('PriceCalculator', () => {
  it('lists every catalog tool to choose from', () => {
    render()

    const picker = screen.getByLabelText('Tools')

    expect(within(picker).getByRole('option', { name: 'Adobe Acrobat' })).toBeInTheDocument()
    expect(within(picker).getByRole('option', { name: 'Redactable' })).toBeInTheDocument()
  })

  it('preselects nothing, so the first-party listing gets no free placement', () => {
    render()

    expect(screen.getByLabelText('Tools')).toHaveValue('')
    expect(screen.queryByTestId('tool-cost-comparison')).not.toBeInTheDocument()
  })

  // The volume is the reader's half of the arithmetic, so it is answerable
  // before they have committed to a tool - and it is what the preview prices.
  it('takes the volume before a tool is chosen', () => {
    render()

    expect(screen.getByLabelText('Documents a month')).toHaveValue(10)
    expect(screen.getByLabelText('Pages per document')).toHaveValue(10)
  })

  it('previews the answer with example figures until a tool is chosen', () => {
    render()

    expect(screen.getByTestId('example-cost-preview')).toBeInTheDocument()
  })

  it('prices the preview off the volume as it is typed', async () => {
    const user = userEvent.setup()
    render()

    const documents = screen.getByLabelText('Documents a month')
    await user.clear(documents)
    await user.type(documents, '100')

    // 100 documents x 10 pages at the $0.10-per-page example rate.
    const starter = screen.getByTestId('cost-row-example-starter')
    expect(within(starter).getByText('$100.00')).toBeInTheDocument()
  })

  it('drops the example once there are real published figures to show', () => {
    render('redactable')

    expect(screen.queryByTestId('example-cost-preview')).not.toBeInTheDocument()
    expect(screen.getByTestId('tool-cost-comparison')).toBeInTheDocument()
  })

  // The fields live on the page now, not inside the per-tool table, so the
  // volume a reader set while browsing must survive choosing a tool.
  it('keeps one set of volume fields once a tool is chosen', async () => {
    const user = userEvent.setup()
    render('redactable')

    const documents = screen.getByLabelText('Documents a month')
    await user.clear(documents)
    await user.type(documents, '5')

    // Five documents on the $1.00-per-document plan.
    expect(
      within(screen.getByTestId('cost-row-redactable-payg')).getByText('$5.00'),
    ).toBeInTheDocument()
  })

  it('puts the chosen tool in the URL, so a calculation can be linked to', async () => {
    const user = userEvent.setup()
    render()

    await user.selectOptions(screen.getByLabelText('Tools'), 'redactable')

    expect(replace).toHaveBeenCalledWith('/price-calculator?tool=redactable', { scroll: false })
  })

  // The calculator answers one question about a tool; everything else the
  // reader now wants - what it redacts, how it was verified - is a page away,
  // and they should not have to go back through the catalog to find it.
  it('links to the profile of each tool it is pricing', () => {
    render('redactable')

    expect(screen.getByRole('link', { name: 'Redactable profile' })).toHaveAttribute(
      'href',
      '/tool/redactable',
    )
  })

  it('calculates against the chosen tool plans', () => {
    render('redactable')

    expect(screen.getByTestId('tool-cost-comparison')).toBeInTheDocument()
    // The default month - ten ten-page documents - on a $1-per-document plan.
    const row = screen.getByTestId('cost-row-redactable-payg')
    expect(within(row).getByText('$10.00')).toBeInTheDocument()
    expect(within(row).getByText('$0.10')).toBeInTheDocument()
  })

  // The point of the page: vendors price in units that do not compare, and
  // comparing them is what the reader came to do.
  it('adds a second tool to the URL rather than replacing the first', async () => {
    const user = userEvent.setup()
    render('redactable')

    await user.selectOptions(screen.getByLabelText('Tools'), 'adobe-acrobat')

    expect(replace).toHaveBeenCalledWith('/price-calculator?tool=redactable&tool=adobe-acrobat', {
      scroll: false,
    })
  })

  it('costs every chosen tool side by side', () => {
    render('redactable', 'adobe-acrobat')

    expect(screen.getByTestId('cost-row-redactable-payg')).toBeInTheDocument()
    expect(screen.getByTestId('cost-row-adobe-acrobat-pro')).toBeInTheDocument()
  })

  // Offering a tool already in the table would either duplicate a block of rows
  // or do nothing, and neither tells the reader which it was.
  it('stops offering a tool once it is in the table', () => {
    render('redactable')

    const picker = screen.getByLabelText('Tools')

    expect(within(picker).queryByRole('option', { name: 'Redactable' })).not.toBeInTheDocument()
    expect(within(picker).getByRole('option', { name: 'Adobe Acrobat' })).toBeInTheDocument()
  })

  it('drops a tool from the URL when its chip is removed', async () => {
    const user = userEvent.setup()
    render('redactable', 'adobe-acrobat')

    await user.click(screen.getByRole('button', { name: 'Remove Redactable' }))

    expect(replace).toHaveBeenCalledWith('/price-calculator?tool=adobe-acrobat', { scroll: false })
  })

  it('goes back to the example when the last tool is removed', async () => {
    const user = userEvent.setup()
    render('redactable')

    await user.click(screen.getByRole('button', { name: 'Remove Redactable' }))

    expect(replace).toHaveBeenCalledWith('/price-calculator', { scroll: false })
  })

  // A saved comparison outlives the listings in it. One tool going away must
  // not take the others' figures down with it - which is what a table blocked
  // on every query resolving would do.
  it('still prices the tools it could load when one of them is gone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render('redactable', 'gone')

    await waitFor(() => expect(screen.getByTestId('cost-row-redactable-payg')).toBeInTheDocument())
  })
})
