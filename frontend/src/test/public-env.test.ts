import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `NEXT_PUBLIC_*` is inlined into the client bundle by `next build`, so a value
 * supplied only to the running container arrives too late and the bundle keeps
 * the `undefined` it was built with - silently, with no error anywhere.
 *
 * Every such variable therefore has to be a Docker build argument, declared in
 * the Dockerfile and passed by the production compose file. This test holds
 * that chain together for whatever the source reads next.
 */
const frontend = process.cwd()
const repoRoot = join(frontend, '..')

function typescriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : typescriptFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Comments mention variable names that nothing reads - see src/lib/env.ts. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const read = (file: string) => readFileSync(file, 'utf8')

const clientSources = [
  join(frontend, 'instrumentation-client.ts'),
  ...typescriptFiles(join(frontend, 'src')),
]

const publicVars = [
  ...new Set(
    clientSources
      .flatMap((file) => [
        ...stripComments(read(file)).matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g),
      ])
      .map((match) => match[1]),
  ),
].sort()

const dockerfile = read(join(frontend, 'Dockerfile'))

const compose = read(join(repoRoot, 'docker-compose-prod.yml'))
/** The only `args:` block in the file is the frontend image's. */
const composeBuildArgs = compose.match(/\n {6}args:\n((?: {8}\S.*\n)+)/)?.[1] ?? ''

describe('the PostHog gate has one home', () => {
  it('is read only by src/lib/analytics.ts', () => {
    const readers = clientSources
      .filter((file) => /process\.env\.NEXT_PUBLIC_POSTHOG_/.test(stripComments(read(file))))
      .map((file) => relative(frontend, file))

    expect(readers).toEqual(['src/lib/analytics.ts'])
  })
})

describe('NEXT_PUBLIC_* reaches the production build', () => {
  it('collects the variables the client reads', () => {
    expect(publicVars).toContain('NEXT_PUBLIC_POSTHOG_KEY')
    expect(publicVars).toContain('NEXT_PUBLIC_API_URL')
    expect(composeBuildArgs).not.toBe('')
  })

  it.each(publicVars)('%s is declared as a build ARG', (name) => {
    expect(dockerfile).toMatch(new RegExp(`^ARG ${name}(=|$)`, 'm'))
  })

  it.each(publicVars)('%s is passed by docker-compose-prod.yml', (name) => {
    expect(composeBuildArgs).toMatch(new RegExp(`^ {8}${name}:`, 'm'))
  })
})
