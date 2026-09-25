'use client'

import { Button } from '@/components/ui/button'
import { useGetBenchmarkSuite } from '@/lib/api/generated/benchmarks/benchmarks'

/** The params the submit page prefetches the suite with; this reads that cache entry. */
export const SUBMIT_SUITE_PARAMS = { scope: 'all' } as const

/**
 * The cases to run, on the page where their outputs are sent: one zip, or one PDF each.
 * Kept in view through every step, because the usual path is download, run the tool,
 * come back - and the one missing case is found only while matching files.
 */
export function CaseDownloads({ suite }: { suite: string }) {
  const { data } = useGetBenchmarkSuite(suite, SUBMIT_SUITE_PARAMS)
  if (!data?.cases.length) return null
  const count = data.cases.length

  return (
    <section
      className="border-border max-w-3xl space-y-3 rounded-md border p-4"
      aria-labelledby="case-downloads"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="case-downloads" className="font-medium">
            Download the cases
          </h2>
          <p className="text-muted-foreground text-sm">
            Revision {data.revision.revision}. Run each one through the tool, unchanged.
          </p>
        </div>
        {data.revision.case_pack_url ? (
          <Button asChild variant="outline">
            <a href={data.revision.case_pack_url} download>
              Download all {count} {count === 1 ? 'case' : 'cases'} (.zip)
            </a>
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.cases.map((item) => (
          <li key={item.case_id}>
            <a
              href={item.pdf_url}
              download
              aria-label={`Download ${item.case_id}`}
              className="font-mono text-xs hover:underline"
            >
              {item.case_id}.pdf
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
