import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AccountCard } from '@/features/account/account-card'
import { getGetMeQueryKey } from '@/lib/api/generated/auth/auth'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

const user = {
  id: '0d1b6f5a-0000-4000-8000-000000000001',
  email: 'user@example.com',
  name: 'Test User',
  is_staff: false,
}

describe('AccountCard', () => {
  it('renders the signed-in user returned by /auth/me', () => {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getGetMeQueryKey(), user)

    renderWithProviders(<AccountCard />, { queryClient })

    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('marks a staff account', () => {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getGetMeQueryKey(), { ...user, is_staff: true })

    renderWithProviders(<AccountCard />, { queryClient })

    expect(screen.getByText('Staff')).toBeInTheDocument()
  })

  it('shows a skeleton while the query is pending', () => {
    renderWithProviders(<AccountCard />)

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })
})
