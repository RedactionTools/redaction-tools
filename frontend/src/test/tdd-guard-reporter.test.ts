import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import config from '../../vitest.config'

// Derived independently of the config's own answer, so this fails if that
// derivation breaks rather than agreeing with it by construction.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', '..')

/**
 * The reporter has to write where the guard reads.
 *
 * Not a test of tdd-guard, which is not ours - a test of the one line of wiring
 * between them, because its failure mode is silent in the worst direction: the
 * guard sees no test output, concludes nothing has been proven, and refuses
 * every implementation edit. Vitest runs from `frontend/`, so left alone the
 * reporter writes `frontend/.claude/tdd-guard/data/test.json`, which nothing
 * reads.
 */
describe('tdd-guard vitest reporter', () => {
  it('is registered alongside the default reporter', () => {
    expect(config.test?.reporters).toContainEqual(
      expect.objectContaining({ constructor: expect.objectContaining({ name: 'VitestReporter' }) }),
    )
  })

  it('writes test.json under the repo root, not under frontend/', () => {
    const reporter = (config.test?.reporters as unknown[]).find(
      (entry) => entry?.constructor?.name === 'VitestReporter',
    ) as { storage: { filePaths: { test: string } } }

    expect(reporter.storage.filePaths.test).toBe(
      path.join(REPO_ROOT, '.claude', 'tdd-guard', 'data', 'test.json'),
    )
  })
})
