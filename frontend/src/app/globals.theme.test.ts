import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The colour utilities the app is allowed to spell.
 *
 * Tailwind v4 generates a utility only if its token exists in the `@theme`
 * block, and silently emits nothing otherwise - so a made-up name survives
 * typecheck, lint and every DOM assertion, and ships as an invisible style.
 * This is the one place that can catch it.
 */
const CSS = readFileSync(join(import.meta.dirname, 'globals.css'), 'utf8')

const THEME_TOKENS = [...CSS.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1])

describe('the theme', () => {
  it('defines the tones the catalog spends on findings', () => {
    expect(THEME_TOKENS).toEqual(expect.arrayContaining(['ok', 'ok-subtle', 'warn', 'warn-subtle']))
  })

  it('gives every token a value in both themes', () => {
    // Matched as blocks, not sliced on the first `.dark`: that string appears
    // in the @custom-variant line above :root.
    const block = (selector: string) =>
      new RegExp(`^${selector}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)?.[1] ?? ''
    const light = block(':root')
    const dark = block('\\.dark')

    for (const token of THEME_TOKENS) {
      expect(light, `--${token} in :root`).toContain(`--${token}:`)
      expect(dark, `--${token} in .dark`).toContain(`--${token}:`)
    }
  })
})
