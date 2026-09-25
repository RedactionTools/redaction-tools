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
import { formatRate, surfaceLabel, type Tone } from '@/lib/benchmarks/format'
import { useQueryClient } from '@tanstack/react-query'

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
  const withdraw = useWithdrawBenchmarkSubmission({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListMyBenchmarkSubmissionsQueryKey() }),
    },
  })

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
