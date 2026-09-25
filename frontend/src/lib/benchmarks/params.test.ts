import { describe, expect, it } from 'vitest'

import { parseBenchmarkParams } from './params'

describe('parseBenchmarkParams', () => {
  it('defaults to the current revision and every result', () => {
    expect(parseBenchmarkParams({})).toEqual({ scope: 'all' })
  })

  it('reads a revision and the verified scope', () => {
    expect(parseBenchmarkParams({ revision: 'v0.1.0', scope: 'verified' })).toEqual({
      revision: 'v0.1.0',
      scope: 'verified',
    })
  })

  it('ignores a scope it does not know and a repeated parameter', () => {
    expect(parseBenchmarkParams({ revision: ['v1', 'v2'], scope: 'everything' })).toEqual({
      revision: 'v1',
      scope: 'all',
    })
  })
})
