import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HealthPanel } from '@/features/health/health-panel'
import { getHealthQueryKey } from '@/lib/api/generated/core/core'
import { makeTestQueryClient, renderWithProviders } from '@/test/render'

describe('HealthPanel', () => {
  it('renders the status reported by the API', () => {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getHealthQueryKey(), { status: 'ok', database: 'ok' })

    renderWithProviders(<HealthPanel />, { queryClient })

    expect(screen.getByTestId('health-status')).toHaveTextContent('ok')
    expect(screen.getByTestId('health-database')).toHaveTextContent('ok')
  })

  it('flags a degraded database, which the API reports with a 200', () => {
    const queryClient = makeTestQueryClient()
    queryClient.setQueryData(getHealthQueryKey(), {
      status: 'degraded',
      database: 'unavailable',
    })

    renderWithProviders(<HealthPanel />, { queryClient })

    expect(screen.getByTestId('health-status')).toHaveTextContent('degraded')
    expect(screen.getByTestId('health-database')).toHaveTextContent('unavailable')
  })
})
