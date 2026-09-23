import { describe, expect, it } from 'vitest'

import { makeTool } from '@/features/catalog/fixtures'

import { buildLlmsFullTxt, buildLlmsTxt } from './llms'

const SITE = 'https://redaction-tools.com'
const GENERATED = new Date('2026-09-20T00:00:00Z')

describe('buildLlmsTxt', () => {
  const DOCS = [
    { title: 'Methodology', url: '/docs/methodology', description: 'Where prices come from.' },
    { title: 'Glossary', url: '/docs/buying/glossary', description: 'The filter vocabulary.' },
  ]
  const text = (tools = [makeTool()], docs = DOCS) => buildLlmsTxt(SITE, tools, GENERATED, docs)

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

  it('points at the calculator, the docs and the full file', () => {
    expect(text()).toContain(`${SITE}/price-calculator`)
    expect(text()).toContain(`${SITE}/docs`)
    expect(text()).toContain(`${SITE}/llms-full.txt`)
  })

  it('lists every documentation page it is handed, with its description', () => {
    expect(text()).toContain('## Documentation')
    expect(text()).toContain(`- [Methodology](${SITE}/docs/methodology): Where prices come from.`)
    expect(text()).toContain(`- [Glossary](${SITE}/docs/buying/glossary)`)
  })

  /**
   * The old URL 308s. Naming it here would hand a crawler a redirect and make
   * this file disagree with the sitemap beside it.
   */
  it('never points at the methodology at its old URL', () => {
    expect(text()).not.toContain(`(${SITE}/methodology)`)
  })

  it('omits the documentation section entirely when there is none', () => {
    expect(text([makeTool()], [])).not.toContain('## Documentation')
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

describe('the blog in llms.txt', () => {
  const POSTS = [
    {
      title: 'Introducing Redaction Tools',
      url: '/blog/introducing',
      description: 'Why we built it.',
    },
  ]

  it('lists each post with its summary', () => {
    const text = buildLlmsTxt(SITE, [makeTool()], GENERATED, [], POSTS)

    expect(text).toContain(
      `## Blog\n\n- [Introducing Redaction Tools](${SITE}/blog/introducing): Why we built it.`,
    )
  })

  it('raises no Blog heading over nothing', () => {
    expect(buildLlmsTxt(SITE, [makeTool()], GENERATED, [], [])).not.toContain('## Blog')
  })
})
