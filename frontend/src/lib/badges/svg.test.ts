import { describe, expect, it } from 'vitest'

import { LOGO_MASK } from './logo'
import {
  contrastOnWhite,
  parseBadgeColor,
  parseBadgeFile,
  parseBadgeTheme,
  renderBadge,
} from './svg'

describe('renderBadge', () => {
  it('claims an earned badge by name, readable to a screen reader', () => {
    const svg = renderBadge({ kind: 'reviewed', earned: true, theme: 'light' })

    expect(svg).toMatch(/^<svg [^>]*role="img"/)
    expect(svg).toContain('aria-label="Redaction Tools: Editor Reviewed"')
    expect(svg).toContain('<title>Redaction Tools: Editor Reviewed</title>')
  })

  it('is a rounded card: our name as a small caption over the claim', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'light' })

    expect(svg).toMatch(/<svg [^>]*height="54"/)
    expect(svg).toMatch(/<rect class="bg"[^>]*rx="10"/)
    expect(svg).toMatch(/<text class="cap"[^>]*>REDACTION TOOLS<\/text>/)
    expect(svg).toMatch(/<text class="hl"[^>]*>Listed Tool<\/text>/)
  })

  it('grows with its claim', () => {
    const width = (svg: string) => Number(/<svg [^>]*width="([\d.]+)"/.exec(svg)![1])

    expect(width(renderBadge({ kind: 'reviewed', earned: true, theme: 'light' }))).toBeGreaterThan(
      width(renderBadge({ kind: 'listed', earned: true, theme: 'light' })),
    )
  })

  it('wears the brand navy on every badge by default, on white', () => {
    for (const kind of ['listed', 'reviewed', 'benchmarked'] as const) {
      const svg = renderBadge({ kind, earned: true, theme: 'light' })

      expect(svg).toContain('.bg{fill:#ffffff;stroke:#192536}')
      expect(svg).toContain('.hl,.lg{fill:#192536}')
    }
  })

  it('softens the caption so the claim reads first', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'light' })

    expect(svg).toContain('.cap{fill:#192536;fill-opacity:.7}')
  })

  it('is a navy card with white text on a dark theme', () => {
    const svg = renderBadge({ kind: 'reviewed', earned: true, theme: 'dark' })

    expect(svg).toContain('.bg{fill:#192536;stroke:#2e3d55}')
    expect(svg).toContain('.hl,.lg{fill:#ffffff}')
  })

  it("follows the reader's colour scheme when the theme is auto", () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'auto' })

    expect(svg).toContain('.bg{fill:#ffffff;stroke:#192536}')
    expect(svg).toMatch(/@media \(prefers-color-scheme:dark\)\{\.bg\{fill:#192536;stroke:#2e3d55\}/)
  })

  it('paints outline, claim and shield in a custom colour, as one piece', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'light', color: 'ff6154' })

    expect(svg).toContain('.bg{fill:#ffffff;stroke:#ff6154}')
    expect(svg).toContain('.hl,.lg{fill:#ff6154}')
  })

  it('keeps a custom colour on the outline of a neutral dark card', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'dark', color: 'ff6154' })

    expect(svg).toContain('.bg{fill:#18181b;stroke:#ff6154}')
    expect(svg).toContain('.hl,.lg{fill:#ffffff}')
  })

  it('goes grey and claims nothing when the badge is no longer earned', () => {
    const svg = renderBadge({ kind: 'reviewed', earned: false, theme: 'light', color: 'ff0000' })

    expect(svg).toContain('aria-label="Redaction Tools"')
    expect(svg).not.toContain('Reviewed')
    expect(svg).not.toContain('ff0000')
    expect(svg).not.toContain('class="cap"')
    expect(svg).toContain('.bg{fill:#ffffff;stroke:#e4e4e7}')
    expect(svg).toContain('.hl,.lg{fill:#a1a1aa}')
  })

  it('goes grey on a dark theme too, without turning into a light patch', () => {
    const svg = renderBadge({ kind: 'listed', earned: false, theme: 'dark' })

    expect(svg).toContain('.bg{fill:#18181b;stroke:#3f3f46}')
  })
})

describe('the logo on a badge', () => {
  it('is inlined, since an SVG shown as an <img> may not fetch anything', () => {
    expect(LOGO_MASK).toMatch(/^data:image\/png;base64,/)
  })

  it('is painted through the white mark as a mask, so it takes the badge colour', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'auto' })

    expect(svg).toMatch(/<mask id="logo"[^>]*><image [^>]*href="data:image\/png;base64,/)
    expect(svg).toMatch(/<rect class="lg"[^>]*mask="url\(#logo\)"/)
    expect(svg.match(/<image /g)).toHaveLength(1)
  })

  it('sits at the head of the card, left of the text', () => {
    const svg = renderBadge({ kind: 'listed', earned: true, theme: 'light' })
    const logo = /<rect class="lg" x="([\d.]+)"[^>]*width="([\d.]+)"/.exec(svg)!
    const textX = Number(/<text class="hl"[^>]*x="([\d.]+)"/.exec(svg)![1])

    expect(Number(logo[2])).toBe(32)
    expect(Number(logo[1]) + 32).toBeLessThan(textX)
  })
})

describe('contrastOnWhite', () => {
  it('rates the brand navy as easily readable and a yellow as not', () => {
    expect(contrastOnWhite('192536')).toBeGreaterThan(10)
    expect(contrastOnWhite('ffcc00')).toBeLessThan(3)
  })
})

describe('parseBadgeColor', () => {
  it.each(['ff9900', '#FF9900'])('accepts %s', (raw) => {
    expect(parseBadgeColor(raw)).toBe('ff9900')
  })

  it.each([null, '', 'fff', 'red', 'ff990', '<script>', 'ff9900"/><script>'])(
    'refuses %s - it ends up inside the SVG',
    (raw) => {
      expect(parseBadgeColor(raw)).toBeNull()
    },
  )
})

describe('parseBadgeFile', () => {
  it('reads the kind out of the file name', () => {
    expect(parseBadgeFile('benchmarked.svg')).toBe('benchmarked')
  })

  it.each(['listed', 'listed.png', 'featured.svg', '../listed.svg'])('refuses %s', (raw) => {
    expect(parseBadgeFile(raw)).toBeNull()
  })
})

describe('parseBadgeTheme', () => {
  it.each(['light', 'dark', 'auto'] as const)('accepts %s', (theme) => {
    expect(parseBadgeTheme(theme)).toBe(theme)
  })

  it('falls back to light for anything else', () => {
    expect(parseBadgeTheme(null)).toBe('light')
    expect(parseBadgeTheme('neon')).toBe('light')
  })
})
