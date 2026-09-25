import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToolLogo } from '@/features/catalog/tool-logo'
import type { LeaderboardRowOut } from '@/lib/api/generated/model'
import { formatPercent, roleLabel, surfaceLabel } from '@/lib/benchmarks/format'

import { ProvenanceBadge } from './provenance-badge'
import { RateCell } from './rate-cell'

/**
 * One revision's leaderboard. The rows arrive ranked (leak rate, then over-redaction)
 * from the API, which is where pooling happens - this only lays them out.
 */
export function LeaderboardTable({
  suite,
  revision,
  rows,
  caseCount,
}: {
  suite: string
  revision: string
  rows: LeaderboardRowOut[]
  caseCount: number
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-md border border-dashed py-10 text-center">
        No results published for {revision} yet.
      </p>
    )
  }

  return (
    <Table>
      <TableCaption>
        Lower leak rate is better. Counts are pooled across cases, never averaged; the bar is the
        95% interval.
      </TableCaption>
      <TableHead>
        <TableRow>
          <TableHeader>#</TableHeader>
          <TableHeader>Tool</TableHeader>
          <TableHeader>Leak rate</TableHeader>
          <TableHeader>Over-redaction</TableHeader>
          <TableHeader>Document</TableHeader>
          <TableHeader>Cases</TableHeader>
          <TableHeader>Published by</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow
            key={`${row.tool.slug}-${row.surface}`}
            data-testid={`leaderboard-row-${row.tool.slug}-${row.surface}`}
          >
            <TableCell className="text-muted-foreground tabular-nums" label="Rank">
              {index + 1}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <ToolLogo name={row.tool.name} logoUrl={row.tool.logo_url} />
                <div>
                  {row.tool.listable ? (
                    <Link
                      href={`/benchmarks/${suite}/tools/${row.tool.slug}?revision=${revision}`}
                      className="font-medium hover:underline"
                    >
                      {row.tool.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.tool.name}</span>
                  )}
                  <p className="text-muted-foreground text-xs">{surfaceLabel(row.surface)}</p>
                </div>
              </div>
            </TableCell>
            <TableCell label="Leak rate">
              <RateCell rate={row.leak_rate} />
            </TableCell>
            <TableCell label="Over-redaction">
              <RateCell rate={row.over_redaction_rate} />
            </TableCell>
            <TableCell label="Document">
              <div className="space-y-1 text-xs">
                <p className="tabular-nums">
                  Text kept: {formatPercent(row.lowest_text_retention)}
                  <span className="text-muted-foreground"> (worst case)</span>
                </p>
                {row.gates_failed ? (
                  <Badge tone="warn">
                    {row.gates_failed} {row.gates_failed === 1 ? 'case' : 'cases'} damaged
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="tabular-nums" label="Cases">
              {row.cases} / {caseCount}
            </TableCell>
            <TableCell label="Published by">
              <div className="space-y-1">
                {row.submitters.map((submitter) => (
                  <p key={`${submitter.name}-${submitter.role}`} className="text-xs">
                    <span className="font-medium">{submitter.name}</span>
                    <span className="text-muted-foreground" aria-hidden="true">
                      {' · '}
                    </span>
                    <span className="text-muted-foreground">{roleLabel(submitter.role)}</span>
                  </p>
                ))}
                <ProvenanceBadge provenance={row.provenance} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
