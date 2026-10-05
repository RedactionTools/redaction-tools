import type { BadgeKind, BadgeTheme } from './svg'

/**
 * The snippets an owner copies onto their own site. Absolute URLs throughout:
 * they are pasted into pages and READMEs we do not host.
 */

export type EmbedFormat = 'html' | 'markdown'

export interface BadgeEmbedOptions {
  site: string
  slug: string
  kind: BadgeKind
  theme: BadgeTheme
  /** Six hex digits, already through `parseBadgeColor`. */
  color?: string | null
}

export const BADGE_ALT: Record<BadgeKind, string> = {
  listed: 'Listed on Redaction Tools',
  reviewed: 'Reviewed by Redaction Tools',
  benchmarked: 'Benchmarked by Redaction Tools',
}

export function badgeImageUrl({ site, slug, kind, theme, color }: BadgeEmbedOptions): string {
  const params = new URLSearchParams()
  // Light is what the route draws with no parameter, so the shortest snippet.
  if (theme !== 'light') params.set('theme', theme)
  if (color) params.set('color', color)
  const query = params.toString()
  return `${site}/badge/${slug}/${kind}.svg${query ? `?${query}` : ''}`
}

export function badgeEmbed(options: BadgeEmbedOptions, format: EmbedFormat): string {
  const image = badgeImageUrl(options)
  const page = `${options.site}/tool/${options.slug}?utm_source=badge`
  const alt = BADGE_ALT[options.kind]
  if (format === 'markdown') return `[![${alt}](${image})](${page})`
  const src = image.replaceAll('&', '&amp;')
  return `<a href="${page}"><img src="${src}" alt="${alt}" height="54"></a>`
}
