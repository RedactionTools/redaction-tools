'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import {
  getListMyBenchmarkSubmissionsQueryKey,
  useListMyBenchmarkSubmissions,
  useWithdrawBenchmarkSubmission,
} from '@/lib/api/generated/benchmarks/benchmarks'
import type { MyRunOut } from '@/lib/api/generated/model'
import { formatRate, surfaceLabel, type Tone } from '@/lib/benchmarks/format'
import { useQueryClient } from '@tanstack/react-query'

import { AddRunScreenshots } from './add-run-screenshots'

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft - not sent', tone: 'neutral' },
  scoring: { label: 'Scoring', tone: 'neutral' },
  scoring_failed: { label: 'Could not be scored', tone: 'warn' },
  pending_review: { label: 'Awaiting review', tone: 'neutral' },
  approved: { label: 'Published', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'warn' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

const WITHDRAWABLE = new Set(['draft', 'scoring', 'scoring_failed', 'pending_review'])

/** Screenshots are evidence, not score: they can be added at any point short of the
 * submission being taken back or turned down. */
const CLOSED = new Set(['withdrawn', 'rejected'])

/** Everything the signed-in account has sent, and what became of it. Polls while
 * anything is still scoring, so the page settles without a reload. */
export function MySubmissions() {
  const queryClient = useQueryClient()
  const { data, isPending } = useListMyBenchmarkSubmissions({
    query: {
      refetchInterval: (query) =>
        query.state.data?.some((s) => s.status === 'scoring') ? 5000 : false,
    },
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListMyBenchmarkSubmissionsQueryKey() })
  const withdraw = useWithdrawBenchmarkSubmission({ mutation: { onSuccess: refresh } })

  if (isPending || !data) return <Skeleton className="h-40 w-full" />

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nothing sent yet.{' '}
        <Link href="/benchmarks/pdf/submit" className="text-foreground font-medium hover:underline">
          Submit results
        </Link>{' '}
        for a tool you have run.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {withdraw.isError ? (
        <li className="text-warn text-sm" role="alert">
          {errorMessage(withdraw.error, 'That could not be withdrawn.')}
        </li>
      ) : null}
      {data.map((submission) => {
        const status = STATUS[submission.status] ?? { label: submission.status, tone: 'neutral' }
        return (
          <li key={submission.id} data-testid={`submission-${submission.id}`}>
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{submission.tool.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {surfaceLabel(submission.surface)} · {submission.suite.toUpperCase()}{' '}
                    {submission.revision} ·{' '}
                    {submission.origin === 'cli' ? 'from the CLI' : 'uploaded'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {WITHDRAWABLE.has(submission.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={withdraw.isPending}
                      onClick={() => withdraw.mutate({ submissionId: submission.id })}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </div>
              {submission.review_note ? (
                <p className="bg-muted rounded-md p-3 text-sm">{submission.review_note}</p>
              ) : null}
              {submission.runs.length ? (
                <ul className="divide-border divide-y text-sm">
                  {submission.runs.map((run) => (
                    <li key={run.run_id} className="flex flex-wrap gap-x-4 gap-y-1 py-1.5">
                      <span className="font-mono text-xs">{run.case_id}</span>
                      <span className="text-muted-foreground text-xs">
                        {run.status === 'scored'
                          ? `Leak rate ${formatRate(run.leak_rate)}`
                          : run.status}
                      </span>
                      {run.error ? (
                        <span className="text-warn w-full text-xs">{run.error}</span>
                      ) : null}
                      <RunShots run={run} />
                      {CLOSED.has(submission.status) ? null : (
                        <AddRunScreenshots
                          runId={run.run_id}
                          label={run.case_id}
                          onAdded={refresh}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

/** The run's screenshots as small thumbnails, each one marked while it waits for an editor. */
function RunShots({ run }: { run: MyRunOut }) {
  if (!run.screenshots.length) return null
  return (
    <ul className="flex w-full flex-wrap gap-2" aria-label={`Screenshots of ${run.case_id}`}>
      {run.screenshots.map((shot, index) => (
        <li key={shot.url} className="space-y-1">
          <a href={shot.url} target="_blank" rel="noreferrer" className="block">
            {/* Not next/image: the backend already rendered the widths it serves. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.url}
              srcSet={shot.srcset || undefined}
              sizes="6rem"
              width={shot.width}
              height={shot.height}
              alt={`Screenshot ${index + 1} of ${run.case_id}`}
              loading="lazy"
              className="border-border h-16 w-24 rounded border object-cover object-top"
            />
          </a>
          {shot.status === 'pending' ? (
            <span className="text-muted-foreground block text-[11px]">Awaiting review</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
