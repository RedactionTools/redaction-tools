import type { MetadataRoute } from 'next'

/**
 * robots.txt, which is not the additive file it looks like.
 *
 * A crawler obeys exactly ONE group - the most specific one naming it - and
 * ignores `*` completely. So a named group is not an addition to the default
 * rules, it is a replacement for them, and `{ userAgent: 'GPTBot', allow: '/' }`
 * would hand GPTBot more of the site than an anonymous crawler gets. Every
 * group therefore repeats `DISALLOWED_PATHS` in full, which is the invariant
 * `robots.test.ts` asserts over each group rather than trusting it here.
 */

/** Paths worth no crawler's budget, whoever is asking. */
export const DISALLOWED_PATHS = ['/?*', '/account', '/auth/', '/my-listings'] as const

/**
 * The answer engines we want quoting the catalog - split out and named rather
 * than left to fall under `*`, which they already would. The access is
 * identical; what the list buys is an auditable statement of who we welcome,
 * and an obvious place for a future decision to close one of them to land.
 */
export const ANSWER_ENGINE_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
  'DuckAssistBot',
  'MistralAI-User',
] as const

/**
 * Allowed, but paced. These fetch at a volume out of all proportion to the
 * traffic or citations they return, and the catalog is served per request with
 * no cache in front of it.
 */
export const RATE_LIMITED_AGENTS = ['Bytespider', 'Amazonbot'] as const

const CRAWL_DELAY_SECONDS = 10

export function buildRobots(site: string): MetadataRoute.Robots {
  const rules = { allow: '/', disallow: [...DISALLOWED_PATHS] }

  return {
    rules: [
      { userAgent: '*', ...rules },
      { userAgent: [...ANSWER_ENGINE_AGENTS], ...rules },
      { userAgent: [...RATE_LIMITED_AGENTS], ...rules, crawlDelay: CRAWL_DELAY_SECONDS },
    ],
    sitemap: `${site}/sitemap.xml`,
  }
}
