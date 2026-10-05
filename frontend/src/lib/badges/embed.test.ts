import { describe, expect, it } from 'vitest'

import { badgeEmbed, badgeImageUrl } from './embed'

const SITE = 'https://redaction.tools'
const BASE = { site: SITE, slug: 'acme-redact', kind: 'listed' as const }

describe('badgeImageUrl', () => {
  it('points at the badge route, with the theme', () => {
    expect(badgeImageUrl({ ...BASE, theme: 'dark' })).toBe(
      `${SITE}/badge/acme-redact/listed.svg?theme=dark`,
    )
  })

  it('leaves the default theme out, and carries a custom colour without its #', () => {
    expect(badgeImageUrl({ ...BASE, theme: 'light', color: 'ff9900' })).toBe(
      `${SITE}/badge/acme-redact/listed.svg?color=ff9900`,
    )
  })
})

describe('badgeEmbed', () => {
  const options = { ...BASE, theme: 'auto' as const }
  const image = `${SITE}/badge/acme-redact/listed.svg?theme=auto`
  const page = `${SITE}/tool/acme-redact?utm_source=badge`

  it('links an image to the tool page, as HTML', () => {
    expect(badgeEmbed(options, 'html')).toBe(
      `<a href="${page}"><img src="${image}" alt="Listed on Redaction Tools" height="54"></a>`,
    )
  })

  it('does the same in Markdown', () => {
    expect(badgeEmbed(options, 'markdown')).toBe(
      `[![Listed on Redaction Tools](${image})](${page})`,
    )
  })
})

it('escapes the ampersand between parameters inside an HTML attribute', () => {
  const html = badgeEmbed({ ...BASE, theme: 'dark', color: 'ff9900' }, 'html')

  expect(html).toContain('listed.svg?theme=dark&amp;color=ff9900"')
})
