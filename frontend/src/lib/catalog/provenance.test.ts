import { describe, expect, it } from 'vitest'

import { PROVENANCE, provenanceLabel } from './provenance'

describe('provenanceLabel', () => {
  it('names a figure our editors typed in', () => {
    expect(provenanceLabel('manual')).toBe('Entered by our editors')
  })

  it('names a figure read off the vendor page', () => {
    expect(provenanceLabel('crawler')).toBe('Read automatically from the vendor')
  })

  // The disclosure that makes accepting vendor input safe at all. It is the
  // reason this map has exactly one copy.
  it('says plainly that a vendor figure is not independently verified', () => {
    expect(provenanceLabel('vendor')).toBe('Supplied by the vendor, not independently verified')
  })

  it('says nothing about a price with no recorded source', () => {
    expect(provenanceLabel(null)).toBeNull()
    expect(provenanceLabel(undefined)).toBeNull()
    expect(provenanceLabel('something-new')).toBeNull()
  })
})

describe('PROVENANCE', () => {
  it('gives every source a glyph, so the badge never leans on colour alone', () => {
    for (const treatment of Object.values(PROVENANCE)) {
      expect(treatment.glyph).toBeTruthy()
      expect(treatment.label).toBeTruthy()
    }
  })
})
