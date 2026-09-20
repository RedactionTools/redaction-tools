/**
 * What the site says it is, in one place.
 *
 * Every string here had two or three hand-written copies before, which is
 * precisely how the description came to promise a benchmark leaderboard that
 * does not exist yet: it was corrected nowhere because it lived everywhere.
 * The social URLs matter for the same reason twice over - they are also the
 * `sameAs` of the Organization node in `json-ld.ts`, and an identity claim
 * that disagrees with the links in the footer is worse than no claim at all.
 */

export const SITE_NAME = 'Redaction Tools'

/**
 * The fallback description, used only where a page sets none of its own - so
 * `/health`, `/account` and the error pages. Everything indexable overrides it.
 * It still has to be true.
 */
export const SITE_DESCRIPTION =
  'Redaction tools compared by price, media and method, with the source and date recorded for every figure.'

export const REDDIT_URL = 'https://www.reddit.com/r/RedactionTools/'
export const LINKEDIN_URL = 'https://www.linkedin.com/company/redaction-tools/'
export const GITHUB_REPO_URL = 'https://github.com/RedactionTools/redaction-tools'

/** The profiles the Organization node claims as its own. */
export const SITE_SOCIAL_URLS = [REDDIT_URL, LINKEDIN_URL, GITHUB_REPO_URL] as const
