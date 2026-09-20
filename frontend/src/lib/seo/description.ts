import type { ToolDetailOut } from '@/lib/api/generated/model'
import { priceSentence } from '@/lib/catalog/format'

/** What a search result will show before it cuts the rest off. */
const SNIPPET_LIMIT = 158

/** Enough room left to be worth saying something in. */
const MIN_USEFUL_TAIL = 20

/**
 * Trim to `limit`, ending on a whole word. The ellipsis is counted inside the
 * limit, because a snippet cut by the search engine after we already cut it is
 * two truncations for the price of one.
 */
export function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text

  const head = text.slice(0, limit - 1)

  // The cut may already have landed on a boundary, with a space as the next
  // character. Trimming back to the previous one would drop a word that fit.
  if (/\s/.test(text.charAt(limit - 1))) return `${head.trimEnd()}…`

  const lastSpace = head.lastIndexOf(' ')

  // A single unbroken word has no boundary to respect; cut it rather than
  // return nothing.
  return lastSpace <= 0 ? `${head}…` : `${head.slice(0, lastSpace)}…`
}

/** The first sentence of a paragraph, which is the part written to stand alone. */
function firstSentence(text: string): string {
  const [sentence] = text.trim().split(/(?<=\.)\s+/)
  return sentence ?? ''
}

/**
 * The `<meta name="description">` for a tool profile.
 *
 * The price sentence leads and is never truncated, even when it alone overruns
 * the limit: it is the one string a search result or an answer engine quotes
 * verbatim, and half a price is worse than a long description. Whatever room is
 * left goes to positioning - the tagline, else the summary's opening sentence -
 * added whole where it fits, so the result never trails off mid-thought.
 */
export function toolMetaDescription(
  tool: Pick<ToolDetailOut, 'name' | 'tagline' | 'summary' | 'price_summary'>,
  limit: number = SNIPPET_LIMIT,
): string {
  const lead = priceSentence(tool.name, tool.price_summary)

  const candidates = [tool.tagline, firstSentence(tool.summary)]
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text))
    // Anything the price sentence already said is not worth the characters.
    .filter((text) => !lead.includes(text) && !text.includes(lead.replace(/\.$/, '')))

  let description = lead

  for (const candidate of candidates) {
    const addition = /[.!?]$/.test(candidate) ? candidate : `${candidate}.`
    if (description.length + 1 + addition.length <= limit) {
      description = `${description} ${addition}`
      continue
    }

    // Nothing more fits whole. Use the tail if there is enough of it to say
    // something, then stop - a second fragment would read as noise.
    const room = limit - description.length - 1
    if (room >= MIN_USEFUL_TAIL) description = `${description} ${truncateAtWord(addition, room)}`
    break
  }

  return description
}
