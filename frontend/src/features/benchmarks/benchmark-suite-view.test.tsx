import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getGetBenchmarkSuiteQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { BenchmarkSuiteView } from './benchmark-suite-view'
import { makeRevision, makeSuite } from './fixtures'

function render(suite = makeSuite(), params = { scope: 'all' as const }) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getGetBenchmarkSuiteQueryKey('pdf', params), suite)
  return renderWithProviders(<BenchmarkSuiteView suite="pdf" params={params} />, { queryClient })
}

describe('BenchmarkSuiteView', () => {
  it('offers every public case, and all of them as one zip', () => {
    render()

    expect(screen.getByRole('link', { name: /download extraction-conditions-1/i })).toHaveAttribute(
      'href',
      expect.stringContaining('extraction-conditions-1.pdf'),
    )
    expect(screen.getByRole('link', { name: /download all 1 case/i })).toHaveAttribute(
      'href',
      expect.stringContaining('.zip'),
    )
  })

  it('shows each case as a thumbnail of its page, linking to the case', () => {
    render()

    const thumbnail = screen.getByRole('img', {
      name: /first page of extraction-conditions-1/i,
    })
    expect(thumbnail.closest('a')).toHaveAttribute(
      'href',
      '/benchmarks/pdf/cases/extraction-conditions-1?revision=v0.1.1',
    )
  })

  it('says how many scored cases are held out, so coverage adds up', () => {
    render(makeSuite({ holdout_case_count: 3 }))

    expect(screen.getByText(/3 holdout cases are scored but not published/i)).toBeInTheDocument()
  })

  it('links to every revision that has cases, marking the current one', () => {
    render(
      makeSuite({
        revisions: [makeRevision(), makeRevision({ revision: 'v0.1.0', is_current: false })],
      }),
    )

    expect(screen.getByRole('link', { name: 'v0.1.0' })).toHaveAttribute(
      'href',
      '/benchmarks/pdf?revision=v0.1.0',
    )
    expect(screen.getByText('v0.1.1')).toHaveAttribute('aria-current', 'page')
  })

  it('switches between every result and the ones we scored or verified', () => {
    render()

    expect(screen.getByRole('link', { name: /verified only/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf?revision=v0.1.1&scope=verified',
    )
  })

  it('invites results', () => {
    render()

    expect(screen.getByRole('link', { name: /submit results/i })).toHaveAttribute(
      'href',
      '/benchmarks/pdf/submit',
    )
  })
})
