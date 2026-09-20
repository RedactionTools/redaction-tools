import { describe, expect, it } from 'vitest'

import { makeTool } from '@/features/catalog/fixtures'

import { buildLlmsFullTxt, buildLlmsTxt } from './llms'

const SITE = 'https://redaction-tools.com'
const GENERATED = new Date('2026-09-20T00:00:00Z')

describe('buildLlmsTxt', () => {
  const text = (tools = [makeTool()]) => buildLlmsTxt(SITE, tools, GENERATED)

  it('opens with an H1 and a blockquote summary', () => {
    const [title, blank, quote] = text().split('\n')

    expect(title).toBe('# Redaction Tools')
    expect(blank).toBe('')
    expect(quote.startsWith('> ')).toBe(true)
  })

  it('counts the catalog in the summary', () => {
    expect(text([makeTool(), makeTool({ slug: 'nitro-pdf' })])).toContain('2 redaction tools')
  })

  it('links every tool at its canonical URL', () => {
    expect(text()).toContain(`[Adobe Acrobat](${SITE}/tool/adobe-acrobat)`)
  })

  // The same sentence the profile renders and the meta description leads with.
  // One fact, one wording, wherever it is read.
  it('describes each tool with the price sentence the page shows', () => {
    expect(text()).toContain(
      'Adobe Acrobat costs from $22.99 USD per month, as of 15 September 2026.',
    )
  })

  it('points at the calculator, the methodology and the full file', () => {
    expect(text()).toContain(`${SITE}/price-calculator`)
    expect(text()).toContain(`${SITE}/methodology`)
    expect(text()).toContain(`${SITE}/llms-full.txt`)
  })

  it('states the trial and free-tier distinction the catalog turns on', () => {
    expect(text()).toMatch(/trial is (never|not)/i)
  })

  // An empty section is a claim that the catalog is empty in a different way
  // from simply not mentioning it.
  it('omits the tools section entirely when there are none', () => {
    expect(text([])).not.toContain('## Tools')
    expect(text([])).toContain('## Reference')
  })
})

describe('buildLlmsFullTxt', () => {
  const text = (tools = [makeTool()]) => buildLlmsFullTxt(SITE, tools, GENERATED)

  it('gives every tool its own fact block', () => {
    expect(text([makeTool(), makeTool({ slug: 'nitro-pdf', name: 'Nitro Pro' })])).toContain(
      '## Nitro Pro',
    )
  })

  it('states the unit and the date in the price line', () => {
    expect(text()).toContain(
      'Price: Adobe Acrobat costs from $22.99 USD per month, as of 15 September 2026.',
    )
  })

  it('gives the entry price as the table renders it', () => {
    expect(text()).toContain('Entry price: From $22.99 per month')
  })

  it('records how the figure was obtained', () => {
    expect(text()).toContain('Price provenance: Entered by our editors')
  })

  it('distinguishes a trial from a free tier', () => {
    expect(text()).toContain('Free tier: no')
    expect(text()).toContain('Trial: 7 days')
  })

  it('names the vendor and links its pricing page', () => {
    expect(text()).toContain('Vendor: Adobe (US)')
    expect(text()).toContain('https://www.adobe.com/acrobat/pricing.html')
  })

  it('stamps the file with the date it was generated', () => {
    expect(text()).toContain('Generated: 2026-09-20')
  })

  it('carries the liftable summary paragraph', () => {
    expect(text()).toContain('Adobe Acrobat Pro includes search-and-redact at $22.99 per month.')
  })
})
