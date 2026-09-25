import { describe, expect, it } from 'vitest'

import { benchmarkDatasetJsonLd, organizationId, toolId } from './json-ld'

const site = 'https://redaction-tools.com'

describe('benchmarkDatasetJsonLd', () => {
  it('describes the case set as a dataset we publish, with a download', () => {
    const node = benchmarkDatasetJsonLd(site, {
      slug: 'pdf',
      name: 'PDF redaction',
      description: 'Synthetic PDFs.',
      revision: 'v0.1.1',
      casePackUrl: 'https://backend.redaction-tools.com/media/benchmarks/x/pdf-v0.1.1-cases.zip',
      tools: [{ slug: 'pdf-redaction', name: 'PDF Redaction' }],
    })

    expect(node['@type']).toBe('Dataset')
    expect(node.url).toBe(`${site}/benchmarks/pdf`)
    expect(node.version).toBe('v0.1.1')
    expect(node.creator).toEqual({ '@id': organizationId(site) })
    expect(node.distribution).toEqual([
      expect.objectContaining({ encodingFormat: 'application/zip' }),
    ])
  })

  it('points at the tools it measures and never redefines them', () => {
    const node = benchmarkDatasetJsonLd(site, {
      slug: 'pdf',
      name: 'PDF redaction',
      description: '',
      revision: 'v0.1.1',
      casePackUrl: null,
      tools: [{ slug: 'pdf-redaction', name: 'PDF Redaction' }],
    })

    expect(node.about).toEqual([{ '@id': toolId(site, 'pdf-redaction') }])
    expect(node.distribution).toBeUndefined()
  })
})
