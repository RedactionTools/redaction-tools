import { describe, expect, it } from 'vitest'

import { landingPath } from '@/lib/auth/landing'

describe('landingPath', () => {
  it.each([
    ['/tools/acme?tab=pricing', '/tools/acme?tab=pricing'],
    // next-auth's signIn() passes the current page as an absolute URL.
    ['http://localhost:3007/tools/acme?tab=pricing#plans', '/tools/acme?tab=pricing#plans'],
    // Another site's URL keeps only its path, so it can only land on this one.
    ['https://evil.example/steal', '/steal'],
    ['//evil.example/steal', '/account'],
    ['https://x.example//evil.example/steal', '/account'],
    ['/\\evil.example/steal', '/account'],
    ['', '/account'],
    [undefined, '/account'],
    [['/a', '/b'], '/account'],
  ])('%j lands on %j', (input, expected) => {
    expect(landingPath(input)).toBe(expected)
  })
})
