import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeMySubmission } from '@/features/benchmarks/fixtures'
import { makeListing } from '@/features/catalog/fixtures'
import { getListMyBenchmarkSubmissionsQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import {
  getListMyClaimsQueryKey,
  getListMyListingsQueryKey,
  getListMySubmissionsQueryKey,
} from '@/lib/api/generated/catalog/catalog'
import type {
  MyClaimOut,
  MyListingOut,
  MySubmissionOut,
  ToolSubmissionOut,
} from '@/lib/api/generated/model'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

import { MyActivity } from './my-activity'

function makeClaim(overrides: Partial<MyClaimOut> = {}): MyClaimOut {
  return {
    id: 1,
    tool: 'adobe-acrobat',
    tool_name: 'Adobe Acrobat',
    work_email: 'rep@adobe.com',
    domain_matched: true,
    status: 'pending_review',
    email_verified_at: '2026-10-01T09:00:00Z',
    created_at: '2026-10-01T09:00:00Z',
    ...overrides,
  }
}

function makeToolSubmission(overrides: Partial<ToolSubmissionOut> = {}): ToolSubmissionOut {
  return {
    id: 1,
    name: 'RedactPro',
    homepage_url: 'https://redactpro.example',
    status: 'under_review',
    created_at: '2026-10-01T09:00:00Z',
    reviewed_at: null,
    ...overrides,
  }
}

function render({
  benchmarks = [],
  claims = [],
  tools = [],
  listings = [],
}: {
  benchmarks?: MySubmissionOut[]
  claims?: MyClaimOut[]
  tools?: ToolSubmissionOut[]
  listings?: MyListingOut[]
} = {}) {
  const queryClient = makeTestQueryClient()
  queryClient.setQueryData(getListMyBenchmarkSubmissionsQueryKey(), benchmarks)
  queryClient.setQueryData(getListMyClaimsQueryKey(), claims)
  queryClient.setQueryData(getListMySubmissionsQueryKey(), tools)
  queryClient.setQueryData(getListMyListingsQueryKey(), listings)
  return renderWithProviders(<MyActivity />, { queryClient })
}

function section(name: RegExp) {
  return screen.getByRole('region', { name })
}

describe('MyActivity', () => {
  it('lists benchmark submissions with where each stands, and links to the full page', () => {
    render({ benchmarks: [makeMySubmission({ status: 'pending_review' })] })

    const benchmarks = section(/benchmark submissions/i)
    expect(within(benchmarks).getByText('PDF Redaction')).toBeInTheDocument()
    expect(within(benchmarks).getByText('Awaiting review')).toBeInTheDocument()
    expect(
      within(benchmarks).getByRole('link', { name: /all benchmark submissions/i }),
    ).toHaveAttribute('href', '/benchmarks/submissions')
  })

  it('flags a benchmark draft that was never sent', () => {
    render({ benchmarks: [makeMySubmission({ status: 'draft' })] })

    expect(within(section(/benchmark submissions/i)).getByText(/not sent/i)).toBeInTheDocument()
  })

  it('lists listing claims by tool, with their status', () => {
    render({ claims: [makeClaim()] })

    const claims = section(/listing claims/i)
    expect(within(claims).getByRole('link', { name: 'Adobe Acrobat' })).toHaveAttribute(
      'href',
      '/tool/adobe-acrobat',
    )
    expect(within(claims).getByText('Awaiting review')).toBeInTheDocument()
  })

  it('lists the tools submitted to the catalog', () => {
    render({ tools: [makeToolSubmission()] })

    const tools = section(/tools you submitted/i)
    expect(within(tools).getByText('RedactPro')).toBeInTheDocument()
    expect(within(tools).getByText('Under review')).toBeInTheDocument()
  })

  it('lists the listings maintained, linking to where they are edited', () => {
    render({ listings: [makeListing()] })

    const listings = section(/listings you maintain/i)
    expect(within(listings).getByText(makeListing().name)).toBeInTheDocument()
    expect(within(listings).getByRole('link', { name: /manage your listings/i })).toHaveAttribute(
      'href',
      '/my-listings',
    )
  })

  it('says plainly when a section is empty, and how to start', () => {
    render()

    expect(within(section(/benchmark submissions/i)).getByText(/nothing yet/i)).toBeInTheDocument()
    expect(
      within(section(/tools you submitted/i)).getByRole('link', { name: /submit a tool/i }),
    ).toHaveAttribute('href', '/submit')
  })
})
