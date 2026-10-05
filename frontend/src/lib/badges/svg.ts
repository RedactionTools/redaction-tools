/**
 * The owners' embeddable badges: a rounded card with our shield, our name as a
 * small caption and the claim beneath it - the shape readers already know from
 * Product Hunt's badges.
 *
 * A pure function: `app/badge/[slug]/[kind]/route.ts` fetches what the tool has
 * earned and hands it here, so everything that ends up inside the SVG is tested
 * without a server.
 */

import { LOGO_MASK } from './logo'

export const BADGE_KINDS = ['listed', 'reviewed', 'benchmarked'] as const
export type BadgeKind = (typeof BADGE_KINDS)[number]

export type BadgeTheme = 'light' | 'dark' | 'auto'

export interface BadgeOptions {
  kind: BadgeKind
  /** False draws the grey "nothing to claim" badge: never a broken image. */
  earned: boolean
  theme: BadgeTheme
  /** Six hex digits, already through `parseBadgeColor`; overrides the kind's own. */
  color?: string | null
}

const NAME = 'Redaction Tools'
const CAPTION = NAME.toUpperCase()

const CLAIMS: Record<BadgeKind, string> = {
  listed: 'Listed Tool',
  reviewed: 'Editor Reviewed',
  benchmarked: 'Benchmarked Tool',
}

/**
 * The navy of the shield itself. One colour across all three badges, as Product
 * Hunt does with its own: the claim says which badge it is, and a row of them on
 * a vendor's page reads as one family rather than three unrelated stickers.
 */
const BRAND = '192536'
/** A navy card on a dark page: the brand, lifted just enough to show its edge. */
const BRAND_DARK = { card: '192536', stroke: '2e3d55' }
/** A custom colour on a dark page keeps a neutral card, so the colour is the outline. */
const NEUTRAL_DARK = '18181b'
const WHITE = 'ffffff'
const GREY = {
  light: { card: WHITE, stroke: 'e4e4e7', ink: 'a1a1aa' },
  dark: { card: NEUTRAL_DARK, stroke: '3f3f46', ink: '71717a' },
}

const HEIGHT = 54
const RADIUS = 10
const LOGO_SIZE = 32
const LOGO_X = 12
const TEXT_X = LOGO_X + LOGO_SIZE + 10
const RIGHT_PADDING = 16
const CAPTION_SIZE = 9
const CAPTION_TRACKING = 0.9
const CLAIM_SIZE = 16

/** Arial/Helvetica Bold advance widths, in ems, for the characters we draw. */
const EM: Record<string, number> = {
  ' ': 0.278,
  A: 0.722,
  B: 0.722,
  C: 0.722,
  D: 0.722,
  E: 0.667,
  I: 0.278,
  L: 0.611,
  N: 0.722,
  O: 0.778,
  R: 0.722,
  S: 0.667,
  T: 0.611,
  a: 0.556,
  b: 0.611,
  c: 0.556,
  d: 0.611,
  e: 0.556,
  h: 0.611,
  i: 0.278,
  k: 0.556,
  l: 0.278,
  m: 0.889,
  n: 0.611,
  o: 0.611,
  r: 0.389,
  s: 0.556,
  t: 0.333,
  v: 0.556,
  w: 0.778,
}

/**
 * Near enough for a box. The text also carries `textLength`, so a reader whose
 * fallback font runs wider or narrower still fits it to the card.
 */
function textWidth(text: string, size: number, tracking = 0): number {
  const ems = [...text].reduce((sum, char) => sum + (EM[char] ?? 0.65), 0)
  return Math.round((ems * size + tracking * (text.length - 1)) * 10) / 10
}

/**
 * Strictly six hex digits, or nothing. The value is written into the SVG's
 * stylesheet, so anything looser is an injection into someone else's page.
 */
export function parseBadgeColor(raw: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(raw ?? '')
  return match ? match[1].toLowerCase() : null
}

/** `listed.svg` -> `listed`; anything that is not exactly one known kind is null. */
export function parseBadgeFile(file: string): BadgeKind | null {
  const kind = file.endsWith('.svg') ? file.slice(0, -'.svg'.length) : ''
  return (BADGE_KINDS as readonly string[]).includes(kind) ? (kind as BadgeKind) : null
}

export function parseBadgeTheme(raw: string | null | undefined): BadgeTheme {
  return raw === 'dark' || raw === 'auto' ? raw : 'light'
}

/** WCAG contrast ratio of a colour against white: 4.5 for body text, 3 for large. */
export function contrastOnWhite(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
}

function card(fill: string, stroke: string, ink: string, caption = true) {
  const soft = caption ? `.cap{fill:#${ink};fill-opacity:.7}` : ''
  return `.bg{fill:#${fill};stroke:#${stroke}}.hl,.lg{fill:#${ink}}${soft}`
}

/** The card, outline and ink - text and shield alike - for one scheme. */
function palette({ earned, color }: BadgeOptions, scheme: 'light' | 'dark'): string {
  if (!earned) {
    const grey = GREY[scheme]
    return card(grey.card, grey.stroke, grey.ink, false)
  }
  if (scheme === 'light') return card(WHITE, color ?? BRAND, color ?? BRAND)
  return color ? card(NEUTRAL_DARK, color, WHITE) : card(BRAND_DARK.card, BRAND_DARK.stroke, WHITE)
}

function style(options: BadgeOptions): string {
  if (options.theme !== 'auto') return palette(options, options.theme)
  return `${palette(options, 'light')}@media (prefers-color-scheme:dark){${palette(options, 'dark')}}`
}

/**
 * The shield, painted rather than placed: the white mark is a luminance mask, so
 * whatever fills `.lg` - navy, white, a vendor's own colour - shows through in
 * the shield's shape, with its letter knocked out to the card beneath.
 */
function logo(): string {
  const box = `x="${LOGO_X}" y="${(HEIGHT - LOGO_SIZE) / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}"`
  return (
    `<mask id="logo" maskUnits="userSpaceOnUse" ${box}><image ${box} href="${LOGO_MASK}"/></mask>` +
    `<rect class="lg" ${box} mask="url(#logo)"/>`
  )
}

function text(cls: string, y: number, size: number, content: string, tracking = 0) {
  const width = textWidth(content, size, tracking)
  const spacing = tracking ? ` letter-spacing="${tracking}"` : ''
  return {
    width,
    svg: `<text class="${cls}" x="${TEXT_X}" y="${y}" font-size="${size}"${spacing} textLength="${width}">${content}</text>`,
  }
}

export function renderBadge(options: BadgeOptions): string {
  const { kind, earned } = options
  const title = earned ? `${NAME}: ${CLAIMS[kind]}` : NAME
  // Earned: caption over claim. Grey: our name alone, centred - it claims nothing.
  const lines = earned
    ? [
        text('cap', 23, CAPTION_SIZE, CAPTION, CAPTION_TRACKING),
        text('hl', 41, CLAIM_SIZE, CLAIMS[kind]),
      ]
    : [text('hl', 32.5, CLAIM_SIZE, NAME)]
  const width = Math.ceil(TEXT_X + Math.max(...lines.map((line) => line.width)) + RIGHT_PADDING)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">`,
    `<title>${title}</title>`,
    `<style>${style(options)}</style>`,
    // Inset by half the stroke, so the outline is not clipped at the edges.
    `<rect class="bg" x="0.5" y="0.5" width="${width - 1}" height="${HEIGHT - 1}" rx="${RADIUS}" stroke-width="1"/>`,
    logo(),
    `<g font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700">${lines.map((line) => line.svg).join('')}</g>`,
    '</svg>',
  ].join('')
}
