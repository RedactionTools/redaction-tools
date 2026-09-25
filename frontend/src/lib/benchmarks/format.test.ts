import { describe, expect, it } from 'vitest'

import {
  caseIdFromFilename,
  formatInterval,
  formatPercent,
  formatRate,
  leakSentence,
  provenanceBadge,
  roleLabel,
  surfaceLabel,
} from './format'

const rate = (count: number, n: number, ci95: [number, number] | null = [0.13, 0.35]) => ({
  count,
  n,
  value: n ? count / n : null,
  ci95: n ? ci95 : null,
})

describe('formatRate', () => {
  it('shows a rate to one decimal place', () => {
    expect(formatRate(rate(12, 54))).toBe('22.2%')
  })

  it('shows an undefined rate as a dash rather than 0%', () => {
    // No over-redaction probes is not "never over-redacts".
    expect(formatRate(rate(0, 0))).toBe('—')
  })
})

describe('formatInterval', () => {
  it('shows the Wilson interval as a range', () => {
    expect(formatInterval(rate(12, 54, [0.131953, 0.349389]))).toBe('13.2–34.9%')
  })

  it('is empty when there is no interval', () => {
    expect(formatInterval(rate(0, 0))).toBe('')
  })
})

describe('formatPercent', () => {
  it('formats a bare fraction, and a missing one as a dash', () => {
    expect(formatPercent(0.931835)).toBe('93.2%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('leakSentence', () => {
  it('says how many sensitive values leaked, out of how many', () => {
    expect(leakSentence(rate(12, 54))).toBe('Leaked 12 of 54 sensitive values (22.2%).')
  })

  it('does not claim a clean sheet when nothing was measured', () => {
    expect(leakSentence(rate(0, 0))).toBe('No sensitive values were in scope.')
  })
})

describe('provenanceBadge', () => {
  it('distinguishes our score from a verified one and a disputed one', () => {
    expect(provenanceBadge('server')).toEqual({ label: 'Scored by us', tone: 'ok' })
    expect(provenanceBadge('verified')).toEqual({ label: 'Self-scored · verified', tone: 'ok' })
    expect(provenanceBadge('unverified')).toEqual({ label: 'Self-scored', tone: 'neutral' })
    expect(provenanceBadge('mismatch')).toEqual({ label: 'Disputed by our rescore', tone: 'warn' })
  })
})

describe('labels', () => {
  it('names who published and how the tool was driven', () => {
    expect(roleLabel('staff')).toBe('Redaction Tools')
    expect(roleLabel('owner')).toBe('Tool owner')
    expect(roleLabel('community')).toBe('Community')
    expect(surfaceLabel('web')).toBe('Web app')
    expect(surfaceLabel('api')).toBe('API')
    expect(surfaceLabel('desktop')).toBe('Desktop app')
  })
})

describe('caseIdFromFilename', () => {
  const cases = ['pii-detection-1', 'pii-detection-10', 'extraction-conditions-1']

  it('finds the case a tool named its output after', () => {
    expect(caseIdFromFilename('redacted-pii-detection-1.pdf', cases)).toBe('pii-detection-1')
    expect(caseIdFromFilename('extraction-conditions-1 (1).pdf', cases)).toBe(
      'extraction-conditions-1',
    )
  })

  it('prefers the longest id, so -10 is not read as -1', () => {
    expect(caseIdFromFilename('pii-detection-10_redacted.pdf', cases)).toBe('pii-detection-10')
  })

  it('never reads a longer number as a shorter id: -12 is not -1', () => {
    // Case ids are unpadded (`pii-detection-1`), so a plain substring match would put
    // the output of a case this revision does not have onto one it does.
    expect(caseIdFromFilename('pii-detection-12.pdf', cases)).toBeNull()
    expect(caseIdFromFilename('redacted-extraction-conditions-17.pdf', cases)).toBeNull()
  })

  it('returns null when the name carries no case id', () => {
    expect(caseIdFromFilename('output.pdf', cases)).toBeNull()
  })
})
