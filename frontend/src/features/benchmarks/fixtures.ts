import type {
  ApiKeyOut,
  CaseDetailOut,
  CaseOut,
  LeaderboardRowOut,
  MySubmissionOut,
  RateOut,
  RevisionOut,
  RunDetailOut,
  RunOut,
  SuiteOut,
  ToolReportOut,
} from '@/lib/api/generated/model'

/** Benchmark test data, shaped exactly like the API's responses. The numbers are the
 * real pdf-redaction:web run on extraction-conditions-1. */

export function makeRate(count: number, n: number): RateOut {
  return { count, n, value: n ? count / n : null, ci95: n ? [0.131953, 0.349389] : null }
}

const counts = { TP: 42, FN: 12, FP: 0, TN: 0, unsupported: 0, undecided: 0 }

export function makeRevision(overrides: Partial<RevisionOut> = {}): RevisionOut {
  return {
    revision: 'v0.1.1',
    generator_version: '0.1.1',
    is_current: true,
    published_at: '2026-09-25T00:00:00Z',
    case_count: 1,
    case_pack_url: 'http://localhost:8007/media/benchmarks/abc/pdf-v0.1.1-cases.zip',
    ...overrides,
  }
}

export function makeCase(overrides: Partial<CaseOut> = {}): CaseOut {
  return {
    case_id: 'extraction-conditions-1',
    family: 'extraction-conditions',
    page_count: 1,
    probe_count: 54,
    probe_summary: {
      targets: 54,
      distractors: 0,
      by_channel: { image_text: 27, text_layer: 27 },
      by_category: { PERSON: 54 },
      by_severity: { high: 54 },
    },
    pdf_url: 'http://localhost:8007/media/benchmarks/def/extraction-conditions-1.pdf',
    preview: {
      url: 'http://localhost:8007/media/benchmarks/ccc/preview.png',
      srcset:
        'http://localhost:8007/media/benchmarks/ccc/w480.webp 480w, http://localhost:8007/media/benchmarks/ccc/w960.webp 960w',
      width: 1241,
      height: 1754,
    },
    ...overrides,
  }
}

export function makeRow(overrides: Partial<LeaderboardRowOut> = {}): LeaderboardRowOut {
  return {
    tool: { slug: 'pdf-redaction', name: 'PDF Redaction', logo_url: '', listable: true },
    surface: 'web',
    leak_rate: makeRate(12, 54),
    over_redaction_rate: makeRate(0, 0),
    counts,
    cases: 1,
    gates_failed: 0,
    lowest_text_retention: 0.931835,
    provenance: 'server',
    runs_excluded: 0,
    submitters: [{ name: 'Redaction Tools', role: 'staff' }],
    last_reviewed_at: '2026-09-25T09:00:00Z',
    ...overrides,
  }
}

export function makeSuite(overrides: Partial<SuiteOut> = {}): SuiteOut {
  return {
    slug: 'pdf',
    name: 'PDF redaction',
    description_md: 'Synthetic one-page PDFs, each seeded with sensitive values.',
    revisions: [makeRevision()],
    revision: makeRevision(),
    scope: 'all',
    cases: [makeCase()],
    holdout_case_count: 0,
    leaderboard: [makeRow()],
    ...overrides,
  }
}

export function makeRun(overrides: Partial<RunOut> = {}): RunOut {
  return {
    run_id: '20260925T081446-pdf-redaction-web-extraction-conditions-1-a1-21dbff',
    case_id: 'extraction-conditions-1',
    family: 'extraction-conditions',
    holdout: false,
    tool: { slug: 'pdf-redaction', name: 'PDF Redaction', logo_url: '', listable: true },
    surface: 'web',
    counts,
    leak_rate: makeRate(12, 54),
    weighted_leak_rate: 0.222222,
    text_retention: 0.931835,
    gates_passed: true,
    overlay: {
      url: 'http://localhost:8007/media/benchmarks/aaa/overlay.png',
      srcset: 'http://localhost:8007/media/benchmarks/aaa/w480.webp 480w',
    },
    output_pdf_url: 'http://localhost:8007/media/benchmarks/bbb/redacted.pdf',
    submitter: { name: 'Tool Owner', role: 'owner' },
    provenance: 'verified',
    scored_by: 'submitter',
    reviewed_at: '2026-09-25T09:00:00Z',
    ...overrides,
  }
}

const breakdowns = {
  by_category: { PERSON: { leak_rate: makeRate(12, 54), over_redaction_rate: makeRate(0, 0) } },
  by_severity: { high: { leak_rate: makeRate(12, 54), over_redaction_rate: makeRate(0, 0) } },
  by_difficulty: {},
  by_kind: {},
  by_trap: {},
  reach: { image_text: makeRate(19, 27), text_layer: makeRate(23, 27) },
  layers: {
    rendered_pixels: {
      layer_leak_rate: makeRate(12, 54),
      exclusive_leak_rate: makeRate(6, 54),
      unavailable: 0,
      severity: 'critical',
      if_it_survives: 'visible to anyone who opens the file',
    },
    ocr: {
      layer_leak_rate: makeRate(0, 0),
      exclusive_leak_rate: makeRate(0, 0),
      unavailable: 1,
      severity: 'high',
      if_it_survives: 'recoverable by OCR',
    },
  },
  gates: { text_retained: { failed: 0, runs: 1 }, not_rasterised: { failed: 1, runs: 1 } },
}

export function makeToolReport(overrides: Partial<ToolReportOut> = {}): ToolReportOut {
  const row = makeRow()
  return {
    tool: row.tool,
    suite: 'pdf',
    revision: 'v0.1.1',
    scope: 'all',
    case_count: 4,
    surfaces: [
      {
        surface: 'web',
        summary: {
          leak_rate: row.leak_rate,
          over_redaction_rate: row.over_redaction_rate,
          counts: row.counts,
          cases: 1,
          gates_failed: 0,
          lowest_text_retention: 0.931835,
          provenance: 'verified',
        },
        runs_excluded: 0,
        breakdowns,
        runs: [makeRun()],
      },
    ],
    ...overrides,
  }
}

export function makeCaseDetail(overrides: Partial<CaseDetailOut> = {}): CaseDetailOut {
  return { ...makeCase(), revision: 'v0.1.1', runs: [makeRun()], ...overrides }
}

export function makeRunDetail(overrides: Partial<RunDetailOut> = {}): RunDetailOut {
  return {
    ...makeRun(),
    report: {
      summary: { leak_rate: makeRate(12, 54), text_retention: 0.931835 },
      survivability: {
        passed: true,
        gates: [{ gate: 'text_retained', passed: true, detail: 'kept 93% of the text' }],
      },
      alignment: { method: 'fiducial', residual_px: 0.348, confident: true },
      engines: { pdfium: '153.0.7999.0', tesseract: 'tesseract 5.5.2' },
      notes: ['layer ocr could not be read: OCR disabled for this run (--no-ocr)'],
      ...breakdowns,
    },
    manifest: { tool_id: 'pdf-redaction:web', observed_at: '2026-09-25T08:14:47+00:00' },
    verification: 'verified',
    verification_diff: {},
    scorer_version: '0.1.1',
    tool_version: '',
    tier: 'Free',
    notes: '',
    revision: 'v0.1.1',
    ...overrides,
  }
}

export function makeMySubmission(overrides: Partial<MySubmissionOut> = {}): MySubmissionOut {
  return {
    id: '5f0c2d1e-0000-4000-8000-000000000001',
    suite: 'pdf',
    revision: 'v0.1.1',
    tool: { slug: 'pdf-redaction', name: 'PDF Redaction', logo_url: '', listable: true },
    surface: 'web',
    origin: 'upload',
    status: 'draft',
    submitter: { name: 'Test User', role: 'community' },
    review_note: '',
    created_at: '2026-09-25T09:00:00Z',
    submitted_at: null,
    reviewed_at: null,
    runs: [],
    ...overrides,
  }
}

export function makeApiKey(overrides: Partial<ApiKeyOut> = {}): ApiKeyOut {
  return {
    prefix: 'Ab12Cd34',
    label: 'laptop',
    created_at: '2026-09-25T09:00:00Z',
    expires_at: null,
    revoked: false,
    ...overrides,
  }
}
