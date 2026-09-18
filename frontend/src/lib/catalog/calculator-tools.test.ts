import { describe, expect, it } from 'vitest'

import { MAX_TOOLS, toolSlugs, toolsHref } from './calculator-tools'

describe('toolSlugs', () => {
  it('reads every tool the URL repeats', () => {
    expect(toolSlugs({ tool: ['redactable', 'adobe-acrobat'] })).toEqual([
      'redactable',
      'adobe-acrobat',
    ])
  })

  it('reads the one tool a single-valued param names', () => {
    expect(toolSlugs({ tool: 'redactable' })).toEqual(['redactable'])
  })

  it('reads nothing from a URL that names no tool', () => {
    expect(toolSlugs({})).toEqual([])
    expect(toolSlugs({ tool: '' })).toEqual([])
  })

  // A slug twice in the URL is one tool, and costing it twice would double a
  // row and break the cheapest badge's tie-naming.
  it('keeps the first of a repeated slug, in the order the URL gave it', () => {
    expect(toolSlugs({ tool: ['redactable', 'adobe-acrobat', 'redactable'] })).toEqual([
      'redactable',
      'adobe-acrobat',
    ])
  })

  // The URL is editable, and a hand-typed one could otherwise fan out a
  // request and a block of rows per slug for as long as somebody kept typing.
  it('takes no more tools than the picker would let you add', () => {
    const many = Array.from({ length: MAX_TOOLS + 3 }, (_, index) => `tool-${index}`)

    expect(toolSlugs({ tool: many })).toHaveLength(MAX_TOOLS)
    expect(toolSlugs({ tool: many })[0]).toBe('tool-0')
  })
})

describe('toolsHref', () => {
  it('repeats the param, so a comparison can be linked to', () => {
    expect(toolsHref('/price-calculator', ['redactable', 'adobe-acrobat'])).toBe(
      '/price-calculator?tool=redactable&tool=adobe-acrobat',
    )
  })

  // Clearing the last tool must leave the bare path, not a dangling `?`, or
  // every emptied calculator gets its own URL.
  it('drops the query altogether when nothing is chosen', () => {
    expect(toolsHref('/price-calculator', [])).toBe('/price-calculator')
  })
})
