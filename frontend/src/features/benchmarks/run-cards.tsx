import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { RunOut } from '@/lib/api/generated/model'
import { formatPercent, formatRate, roleLabel } from '@/lib/benchmarks/format'

import { OverlayFigure } from './overlay-figure'
import { ProvenanceBadge } from './provenance-badge'

/**
 * One card per run: the overlay, the numbers, who published it and where to dig in.
 * `heading` picks what names a card - the case on a tool report, the tool on a case.
 */
export function RunCards({
  suite,
  runs,
  heading,
}: {
  suite: string
  runs: RunOut[]
  heading: 'case' | 'tool'
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {runs.map((run, index) => {
        const title = run.holdout
          ? 'Holdout case'
          : heading === 'case'
            ? run.case_id
            : run.tool.name
        return (
          <li key={run.run_id || `holdout-${index}`}>
            <Card className="space-y-3 p-4">
              <p className={heading === 'case' ? 'font-mono text-sm' : 'font-medium'}>{title}</p>
              {run.overlay ? <OverlayFigure overlay={run.overlay} label={title} /> : null}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Leak rate</dt>
                  <dd className="tabular-nums">
                    {formatRate(run.leak_rate)}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({run.counts.FN} of {run.leak_rate.n})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Weighted</dt>
                  <dd className="tabular-nums">{formatPercent(run.weighted_leak_rate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Text kept</dt>
                  <dd className="tabular-nums">{formatPercent(run.text_retention)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Document</dt>
                  <dd>
                    {run.gates_passed === false ? <Badge tone="warn">Damaged</Badge> : 'Intact'}
                  </dd>
                </div>
              </dl>
              <p className="text-xs">
                <span className="font-medium">{run.submitter.name}</span>
                <span className="text-muted-foreground" aria-hidden="true">
                  {' · '}
                </span>
                <span className="text-muted-foreground">{roleLabel(run.submitter.role)}</span>
              </p>
              <ProvenanceBadge provenance={run.provenance} />
              {run.holdout ? null : (
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/benchmarks/${suite}/runs/${run.run_id}`}
                    className="hover:underline"
                  >
                    Full report
                  </Link>
                  {run.output_pdf_url ? (
                    <a href={run.output_pdf_url} className="hover:underline">
                      Redacted PDF
                    </a>
                  ) : null}
                </div>
              )}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
