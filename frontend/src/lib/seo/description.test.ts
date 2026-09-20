import { describe, expect, it } from 'vitest'

import { makeToolDetail } from '@/features/catalog/fixtures'

import { toolMetaDescription, truncateAtWord } from './description'

describe('truncateAtWord', () => {
  it('leaves text that already fits', () => {
    expect(truncateAtWord('short enough', 40)).toBe('short enough')
  })

  it('cuts at a word boundary rather than mid-word', () => {
    expect(truncateAtWord('redaction for video and audio files', 20)).toBe('redaction for video…')
  })

  it('drops the partial word when the cut lands inside one', () => {
    expect(truncateAtWord('redaction for video and audio files', 24)).toBe(
      'redaction for video and…',
    )
  })

  it('counts the ellipsis inside the limit', () => {
    expect(truncateAtWord('redaction for video and audio files', 20).length).toBeLessThanOrEqual(20)
  })

  it('hard-cuts a single unbroken word', () => {
    expect(truncateAtWord('supercalifragilistic', 10)).toHaveLength(10)
  })
})

describe('toolMetaDescription', () => {
  const withTagline = (tagline: string) => {
    const tool = makeToolDetail()
    tool.tagline = tagline
    return tool
  }

  // This is the string a search result or an answer engine quotes back, so the
  // fact it carries has to survive intact and has to come first.
  it('leads with the price sentence the page itself shows', () => {
    const tool = makeToolDetail()

    expect(toolMetaDescription(tool)).toMatch(/^Adobe Acrobat costs from/)
  })

  it('adds the tagline when both fit', () => {
    const description = toolMetaDescription(withTagline('Redaction built into the PDF editor.'))

    expect(description).toContain('Redaction built into the PDF editor.')
  })

  it('stays inside the limit it is given', () => {
    const tool = withTagline('A very long tagline '.repeat(20))

    expect(toolMetaDescription(tool, 158).length).toBeLessThanOrEqual(158)
  })

  it('never ends mid-word', () => {
    const words =
      'Redaction built directly into the familiar editor for enterprise teams everywhere today'
    const tool = withTagline(`${words} ${words}`)

    const description = toolMetaDescription(tool, 158)
    const lastWord = description
      .replace(/[….]+$/, '')
      .split(' ')
      .pop()

    expect(description).toMatch(/…$/)
    expect(`${words} ${words}`.split(' ')).toContain(lastWord)
  })

  it('falls back to the summary when there is no tagline', () => {
    const tool = makeToolDetail()
    tool.tagline = ''
    tool.summary = 'Acrobat Pro bundles search-and-redact. It also does much else besides.'

    expect(toolMetaDescription(tool)).toContain('Acrobat Pro bundles search-and-redact.')
  })

  it('takes only the summary first sentence, not the whole paragraph', () => {
    const tool = makeToolDetail()
    tool.tagline = ''
    tool.summary = 'Acrobat Pro bundles search-and-redact. It also does much else besides.'

    expect(toolMetaDescription(tool)).not.toContain('much else besides')
  })

  it('says only the price when the listing offers nothing else', () => {
    const tool = makeToolDetail()
    tool.tagline = ''
    tool.summary = ''

    expect(toolMetaDescription(tool)).toBe(toolMetaDescription(tool).trim())
    expect(toolMetaDescription(tool)).toMatch(/costs from/)
  })

  // A truncated price is worse than a long description.
  it('keeps the price sentence whole even when it alone overruns', () => {
    const tool = makeToolDetail()
    tool.name = 'A'.repeat(200)

    expect(toolMetaDescription(tool, 158)).toContain('costs from')
    expect(toolMetaDescription(tool, 158)).not.toContain('…')
  })

  it('does not repeat the tool name when the tagline already opens with it', () => {
    const description = toolMetaDescription(
      withTagline('Adobe Acrobat costs from $22.99 USD per month'),
    )

    expect(description.match(/costs from/g)).toHaveLength(1)
  })
})
