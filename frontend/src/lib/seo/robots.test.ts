import { describe, expect, it } from 'vitest'

import { ANSWER_ENGINE_AGENTS, DISALLOWED_PATHS, buildRobots } from './robots'

const SITE = 'https://redaction-tools.com'

/** Every group robots.txt will carry, however the rules were declared. */
function groups(site = SITE) {
  const { rules } = buildRobots(site)
  return Array.isArray(rules) ? rules : [rules]
}

describe('buildRobots', () => {
  it('points every crawler at an absolute sitemap URL', () => {
    expect(buildRobots(SITE).sitemap).toBe(`${SITE}/sitemap.xml`)
  })

  it('keeps crawlers out of the faceted hub', () => {
    const [anonymous] = groups()

    expect(anonymous.disallow).toContain('/?*')
  })

  it('keeps them out of the signed-in areas', () => {
    const [anonymous] = groups()

    expect(anonymous.disallow).toEqual(expect.arrayContaining(['/account', '/my-listings']))
  })

  // The one that matters. A crawler obeys the single most specific group that
  // names it and ignores `*` entirely, so a named group that forgets a path is
  // a named group that has been granted MORE access than an anonymous one.
  it('repeats the whole disallow list in every named group', () => {
    for (const group of groups()) {
      expect([...(group.disallow ?? [])].sort()).toEqual([...DISALLOWED_PATHS].sort())
    }
  })

  it('never shuts a crawler out of the catalog itself', () => {
    for (const group of groups()) {
      expect(group.allow).toBe('/')
      expect(group.disallow).not.toContain('/')
    }
  })

  it('welcomes the answer engines by name', () => {
    const named = groups().flatMap((group) => group.userAgent ?? [])

    for (const agent of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(named).toContain(agent)
    }
  })

  it('throttles the crawlers that take far more than they cite', () => {
    const throttled = groups().find((group) => group.crawlDelay !== undefined)

    expect(throttled?.userAgent).toContain('Bytespider')
    expect(throttled?.crawlDelay).toBeGreaterThan(0)
  })

  it('leaves the answer engines unthrottled', () => {
    const answerEngines = groups().find((group) =>
      [group.userAgent ?? []].flat().includes(ANSWER_ENGINE_AGENTS[0]),
    )

    expect(answerEngines?.crawlDelay).toBeUndefined()
  })
})
