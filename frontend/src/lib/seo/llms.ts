import type { ToolListItemOut } from '@/lib/api/generated/model'
import { priceHeadline, priceSentence, verifiedOn } from '@/lib/catalog/format'
import { provenanceLabel } from '@/lib/catalog/provenance'
import { SITE_NAME } from '@/lib/seo/site'

/**
 * The catalog as plain text, for the readers that are not browsers.
 *
 * Both files are built from the list response alone - never one `getTool` per
 * slug. These are public, uncacheable routes fetched by robots; an N+1 behind
 * them would turn one crawl into one request per listing. The list row already
 * carries every fact stated here, and anything deeper belongs in a backend
 * bulk endpoint rather than in a loop on this side.
 *
 * `generatedAt` is passed in rather than read from the clock so the output is
 * something a test can assert on.
 */

const ISO_DATE = (date: Date) => date.toISOString().slice(0, 10)

/** The standing explanation of what a price in this catalog means. */
const PROVENANCE_NOTE =
  'Prices are marked with how we obtained them: read automatically from the vendor’s ' +
  'published pricing page, entered by our editors, or supplied by the vendor and not ' +
  'independently verified. A trial is never presented as a free tier — "free for 14 days" ' +
  'and "free forever" are stored and rendered as different things.'

function toolLink(site: string, tool: ToolListItemOut): string {
  return `- [${tool.name}](${site}/tool/${tool.slug}): ${priceSentence(tool.name, tool.price_summary)}`
}

function pageLink(site: string, page: DocsEntry): string {
  return `- [${page.title}](${site}${page.url})${page.description ? `: ${page.description}` : ''}`
}

/**
 * The short index, in the shape llmstxt.org describes: a title, a blockquote
 * that stands on its own, prose, then sections of links.
 */
/** A docs page, as `app/llms.txt/route.ts` reads it off the fumadocs source. */
export type DocsEntry = { title: string; url: string; description?: string }

/**
 * `docs` is a parameter for the same reason the sitemap's is: the tree comes
 * from a fumadocs macro that throws outside the bundler, and this module has
 * unit tests.
 */
export function buildLlmsTxt(
  site: string,
  tools: ToolListItemOut[],
  generatedAt: Date,
  docs: readonly DocsEntry[] = [],
  posts: readonly DocsEntry[] = [],
): string {
  const sections: string[] = [
    `# ${SITE_NAME}`,
    tools.length
      ? `> A catalog of ${tools.length} redaction tools for PDF, image, video and audio. Every\n` +
        `> price carries its unit, its currency and the date we last checked it.`
      : `> A catalog of redaction tools for PDF, image, video and audio. Every price carries\n` +
        `> its unit, its currency and the date we last checked it.`,
    `${PROVENANCE_NOTE} Last generated ${ISO_DATE(generatedAt)}.`,
  ]

  // No empty section: saying "## Tools" over nothing is a different claim from
  // not raising the subject.
  if (tools.length) {
    sections.push(['## Tools', '', ...tools.map((tool) => toolLink(site, tool))].join('\n'))
  }

  sections.push(
    [
      '## Reference',
      '',
      `- [Price calculator](${site}/price-calculator): Cost any tool’s plans against your own document volume.`,
      `- [Documentation](${site}/docs): How prices are verified, what a listing means, and how to read the catalog with a machine.`,
      `- [Submit a tool](${site}/submit): Tell us about a redaction tool we are missing.`,
      `- [Full catalog facts](${site}/llms-full.txt): Every tool’s price, vendor and provenance as plain text.`,
    ].join('\n'),
  )

  // Same rule as the tools section above: no heading over an empty list.
  if (docs.length) {
    sections.push(['## Documentation', '', ...docs.map((doc) => pageLink(site, doc))].join('\n'))
  }

  // Posts arrive newest first, from the same macro-free route as the docs.
  if (posts.length) {
    sections.push(['## Blog', '', ...posts.map((post) => pageLink(site, post))].join('\n'))
  }

  return `${sections.join('\n\n')}\n`
}

function factBlock(site: string, tool: ToolListItemOut): string {
  const summary = tool.price_summary
  const lines = [
    `## ${tool.name}`,
    `URL: ${site}/tool/${tool.slug}`,
    `Vendor: ${tool.vendor.name}${tool.vendor.hq_country ? ` (${tool.vendor.hq_country})` : ''}`,
    `Price: ${priceSentence(tool.name, summary)}`,
    `Entry price: ${priceHeadline(summary)}`,
    `Free tier: ${summary.has_free_tier ? 'yes' : 'no'}`,
    `Trial: ${summary.is_trial && summary.trial_days ? `${summary.trial_days} days` : 'none published'}`,
  ]

  if (tool.facet_slugs.length) lines.push(`Facets: ${tool.facet_slugs.join(', ')}`)

  const provenance = provenanceLabel(summary.source)
  if (provenance) lines.push(`Price provenance: ${provenance}`)

  const checked = verifiedOn(summary)
  if (checked) lines.push(`Price checked: ${checked}`)
  if (summary.source_url) lines.push(`Vendor pricing page: ${summary.source_url}`)
  if (tool.tagline) lines.push(`Tagline: ${tool.tagline}`)
  if (tool.summary) lines.push(`Summary: ${tool.summary}`)

  return lines.join('\n')
}

/** Every fact the catalog holds about every listing, one block each. */
export function buildLlmsFullTxt(
  site: string,
  tools: ToolListItemOut[],
  generatedAt: Date,
): string {
  const header = [
    `# ${SITE_NAME} — full catalog`,
    '',
    '> Every listed redaction tool with its published price, the unit that price is charged',
    '> in, and the date we last checked it.',
    '',
    `Source: ${site}/`,
    `Generated: ${ISO_DATE(generatedAt)}`,
    `Tools listed: ${tools.length}`,
    '',
    PROVENANCE_NOTE,
  ].join('\n')

  const blocks = tools.map((tool) => factBlock(site, tool))

  return `${[header, ...blocks].join('\n\n')}\n`
}
