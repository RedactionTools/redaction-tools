import { describe, expect, it } from 'vitest'

import {
  FACET_DIMENSIONS,
  hasActiveFilters,
  parseToolFilters,
  toQueryString,
  toggleFacet,
} from './filters'

describe('parseToolFilters', () => {
  it('reads facets, search and ordering off the URL', () => {
    const filters = parseToolFilters({ media: 'video,audio', q: 'redact', ordering: '-price' })

    expect(filters.media).toBe('video,audio')
    expect(filters.q).toBe('redact')
    expect(filters.ordering).toBe('-price')
  })

  it('coerces the free-tier flag, which arrives as a string', () => {
    expect(parseToolFilters({ has_free_tier: 'true' }).has_free_tier).toBe(true)
    expect(parseToolFilters({}).has_free_tier).toBeUndefined()
  })

  it('ignores an ordering the API does not accept', () => {
    expect(parseToolFilters({ ordering: 'rank; drop table' }).ordering).toBeUndefined()
  })

  it('ignores unknown parameters rather than forwarding them', () => {
    expect(parseToolFilters({ colour: 'red' })).toEqual({})
  })
})

describe('hasActiveFilters', () => {
  it('is false for the bare hub, which is the only indexable variant', () => {
    expect(hasActiveFilters({})).toBe(false)
  })

  it('is true as soon as anything narrows the list', () => {
    expect(hasActiveFilters({ media: 'video' })).toBe(true)
    expect(hasActiveFilters({ q: 'redact' })).toBe(true)
  })

  it('does not count ordering: the same set in a different order is the same page', () => {
    expect(hasActiveFilters({ ordering: 'name' })).toBe(false)
  })
})

describe('toggleFacet', () => {
  it('adds a value to an empty dimension', () => {
    expect(toggleFacet({}, 'media', 'video').media).toBe('video')
  })

  it('appends within a dimension, because values there are an OR', () => {
    expect(toggleFacet({ media: 'video' }, 'media', 'audio').media).toBe('video,audio')
  })

  it('removes a value that was already selected', () => {
    expect(toggleFacet({ media: 'video,audio' }, 'media', 'video').media).toBe('audio')
  })

  it('drops the parameter entirely once its last value goes', () => {
    expect(toggleFacet({ media: 'video' }, 'media', 'video').media).toBeUndefined()
  })

  it('resets paging, since page 3 of the old filter is meaningless', () => {
    expect(toggleFacet({ page: 3 }, 'media', 'video').page).toBeUndefined()
  })
})

describe('toQueryString', () => {
  it('produces a stable order so the same filters give the same URL', () => {
    expect(toQueryString({ q: 'redact', media: 'video' })).toBe('media=video&q=redact')
  })

  it('is empty for the bare hub', () => {
    expect(toQueryString({})).toBe('')
  })
})

describe('FACET_DIMENSIONS', () => {
  it('leads with media, the primary filter on this domain', () => {
    expect(FACET_DIMENSIONS[0]).toBe('media')
  })
})
