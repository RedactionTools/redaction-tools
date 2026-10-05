import { describe, expect, it } from 'vitest'

import { benchmarkHref, isAlternateView, parseBenchmarkParams } from './params'

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

describe('benchmarkHref', () => {
  // `?revision=<current>` is the clean page under a second, noindexed URL. Linking
  // it sent crawlers to the copy and left the canonical page unlinked.
  it('leaves the current revision out of the URL', () => {
    expect(
      benchmarkHref('/benchmarks/pdf/tools/kept', { revision: 'v0.1.1', isCurrent: true }),
    ).toBe('/benchmarks/pdf/tools/kept')
  })

  it('names a superseded revision, which is a different page', () => {
    expect(
      benchmarkHref('/benchmarks/pdf/tools/kept', { revision: 'v0.1.0', isCurrent: false }),
    ).toBe('/benchmarks/pdf/tools/kept?revision=v0.1.0')
  })

  it('adds the verified scope after the revision', () => {
    expect(
      benchmarkHref('/benchmarks/pdf', { revision: 'v0.1.1', isCurrent: true, scope: 'verified' }),
    ).toBe('/benchmarks/pdf?scope=verified')
    expect(
      benchmarkHref('/benchmarks/pdf', { revision: 'v0.1.0', isCurrent: false, scope: 'verified' }),
    ).toBe('/benchmarks/pdf?revision=v0.1.0&scope=verified')
  })
})

describe('isAlternateView', () => {
  it('treats the plain page as the one to index', () => {
    expect(isAlternateView({ scope: 'all' }, true)).toBe(false)
  })

  // Old links and shares still carry it; the canonical folds it into the plain page.
  it('does not treat the current revision named in the URL as another view', () => {
    expect(isAlternateView({ revision: 'v0.1.1', scope: 'all' }, true)).toBe(false)
  })

  it('treats a superseded revision and the verified-only view as other views', () => {
    expect(isAlternateView({ revision: 'v0.1.0', scope: 'all' }, false)).toBe(true)
    expect(isAlternateView({ scope: 'verified' }, true)).toBe(true)
  })
})
