import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PooledOut, RateOut } from '@/lib/api/generated/model'
import { formatInterval, formatPercent, formatRate, leakSentence } from '@/lib/benchmarks/format'

import { ProvenanceBadge } from './provenance-badge'
import { RateCell } from './rate-cell'

/**
 * The sections of a benchmark report, laid out in the order pdfredeval's own report
 * uses: the verdict, the document's condition, where the leaks are, what was not
 * measured. Shared by the pooled tool report and the single-run report.
 *
 * `breakdowns` is the scorer's free-form structure (pooled on the server, or one
 * run's report.json), so it is typed here, locally, by what this reads - not declared
 * in the API contract, where it would drift from the scorer that writes it.
 */

type Grouped = Record<string, { leak_rate: RateOut; over_redaction_rate: RateOut }>
type Layer = {
  layer_leak_rate: RateOut
  exclusive_leak_rate: RateOut
  unavailable: number
  severity: string
  if_it_survives: string
}
export type Breakdowns = {
  by_category?: Grouped
  by_severity?: Grouped
  by_difficulty?: Grouped
  by_trap?: Grouped
  reach?: Record<string, RateOut>
  layers?: Record<string, Layer>
  gates?: Record<string, { failed: number; runs: number }>
}

export function ReportHero({
  summary,
  caseCount,
  testId,
}: {
  summary: PooledOut
  caseCount: number
  testId: string
}) {
  return (
    <Card className="space-y-4" data-testid={testId}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-muted-foreground text-sm">Leak rate</p>
          <p className="text-5xl font-semibold tabular-nums">{formatRate(summary.leak_rate)}</p>
        </div>
        <p className="text-muted-foreground pb-1 text-sm tabular-nums">
          95% interval {formatInterval(summary.leak_rate)} · n = {summary.leak_rate.n}
        </p>
        <ProvenanceBadge provenance={summary.provenance} />
      </div>
      <p>{leakSentence(summary.leak_rate)}</p>
      <dl className="grid gap-4 text-sm sm:grid-cols-4">
        <Kpi label="Over-redaction" value={formatRate(summary.over_redaction_rate)} />
        <Kpi label="Text kept (worst case)" value={formatPercent(summary.lowest_text_retention)} />
        <Kpi label="Cases covered" value={`${summary.cases} of ${caseCount} cases`} />
        <Kpi
          label="Document damaged"
          value={summary.gates_failed ? `${summary.gates_failed} cases` : 'None'}
        />
      </dl>
    </Card>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function ReportBreakdowns({ breakdowns }: { breakdowns: Breakdowns }) {
  const layers = Object.entries(breakdowns.layers ?? {})
  const measured = layers.filter(([, layer]) => layer.layer_leak_rate.n > 0)
  const gaps = layers.filter(([, layer]) => layer.unavailable > 0)
  const failedGates = Object.entries(breakdowns.gates ?? {}).filter(([, gate]) => gate.failed)

  return (
    <div className="space-y-8">
      {failedGates.length ? (
        <section className="space-y-2">
          <h3 className="font-semibold">Is the document still usable?</h3>
          <ul className="space-y-1 text-sm">
            {failedGates.map(([gate, { failed, runs }]) => (
              <li key={gate}>
                <Badge tone="warn">
                  {gate} failed in {failed} of {runs}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {measured.length ? (
        <section className="space-y-2" data-testid="breakdown-layers">
          <h3 className="font-semibold">Where the leaks are</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Layer</TableHeader>
                <TableHeader>Leaked here</TableHeader>
                <TableHeader>Only here</TableHeader>
                <TableHeader>If it survives</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {measured.map(([name, layer]) => (
                <TableRow key={name}>
                  <TableCell>
                    <span className="font-mono text-xs">{name}</span>{' '}
                    <Badge tone={layer.severity === 'critical' ? 'warn' : 'neutral'}>
                      {layer.severity}
                    </Badge>
                  </TableCell>
                  <TableCell label="Leaked here">
                    <RateCell rate={layer.layer_leak_rate} />
                  </TableCell>
                  <TableCell label="Only here">
                    <RateCell rate={layer.exclusive_leak_rate} />
                  </TableCell>
                  <TableCell className="text-muted-foreground" label="If it survives">
                    {layer.if_it_survives}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <GroupedTable title="By category" rows={breakdowns.by_category} />
      <GroupedTable title="By severity" rows={breakdowns.by_severity} />
      <GroupedTable title="By trap" rows={breakdowns.by_trap} />

      {breakdowns.reach && Object.keys(breakdowns.reach).length ? (
        <section className="space-y-2">
          <h3 className="font-semibold">Removed, by where the value lives</h3>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            {Object.entries(breakdowns.reach).map(([channel, rate]) => (
              <div key={channel}>
                <dt className="text-muted-foreground font-mono text-xs">{channel}</dt>
                <dd>
                  <RateCell rate={rate} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="space-y-2" data-testid="not-measured">
        <h3 className="font-semibold">What was not measured</h3>
        {gaps.length ? (
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {gaps.map(([name, layer]) => (
              <li key={name}>
                <span className="font-mono">{name}</span> could not be read in {layer.unavailable}{' '}
                {layer.unavailable === 1 ? 'run' : 'runs'}, so it is not counted as clean there.
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Every layer was read in every run.</p>
        )}
      </section>
    </div>
  )
}

function GroupedTable({ title, rows }: { title: string; rows?: Grouped }) {
  const entries = Object.entries(rows ?? {}).filter(([, row]) => row.leak_rate.n > 0)
  if (!entries.length) return null
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>{title.replace('By ', '')}</TableHeader>
            <TableHeader>Leak rate</TableHeader>
            <TableHeader>Over-redaction</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map(([key, row]) => (
            <TableRow key={key}>
              <TableCell className="font-mono text-xs">{key}</TableCell>
              <TableCell label="Leak rate">
                <RateCell rate={row.leak_rate} />
              </TableCell>
              <TableCell label="Over-redaction">
                <RateCell rate={row.over_redaction_rate} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
