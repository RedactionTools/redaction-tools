'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SUBMISSION_STATUS } from '@/features/benchmarks/my-submissions'
import { useListMyBenchmarkSubmissions } from '@/lib/api/generated/benchmarks/benchmarks'
import {
  useListMyClaims,
  useListMyListings,
  useListMySubmissions,
} from '@/lib/api/generated/catalog/catalog'
import { surfaceLabel, type Tone } from '@/lib/benchmarks/format'

type Status = { label: string; tone: Tone }

const CLAIM_STATUS: Record<string, Status> = {
  pending_verification: { label: 'Check your work email for the code', tone: 'warn' },
  pending_review: { label: 'Awaiting review', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'warn' },
  revoked: { label: 'Revoked', tone: 'neutral' },
}

const TOOL_STATUS: Record<string, Status> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'neutral' },
  published: { label: 'Published', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'warn' },
  duplicate: { label: 'Already listed', tone: 'neutral' },
}

function statusOf(table: Record<string, Status>, status: string): Status {
  return table[status] ?? { label: status, tone: 'neutral' }
}

/**
 * Everything the signed-in account has sent us, in one place: benchmark results,
 * listing claims, tools proposed for the catalog, and the listings it maintains.
 * Each section is a summary that links on to the page where the work is done - this
 * page decides nothing itself.
 */
export function MyActivity() {
  return (
    <div className="space-y-6">
      <BenchmarkSection />
      <ClaimSection />
      <ToolSubmissionSection />
      <ListingSection />
    </div>
  )
}

function BenchmarkSection() {
  const { data } = useListMyBenchmarkSubmissions()
  return (
    <ActivitySection
      title="Benchmark submissions"
      more={{ href: '/benchmarks/submissions', label: 'All benchmark submissions' }}
      empty={
        <>
          Nothing yet. <InlineLink href="/benchmarks/pdf/submit">Submit results</InlineLink> for a
          tool you have run.
        </>
      }
      items={data?.map((submission) => ({
        key: submission.id,
        title: submission.tool.name,
        detail: `${surfaceLabel(submission.surface)} · ${submission.suite.toUpperCase()} ${submission.revision}`,
        status: statusOf(SUBMISSION_STATUS, submission.status),
      }))}
    />
  )
}

function ClaimSection() {
  const { data } = useListMyClaims()
  return (
    <ActivitySection
      title="Listing claims"
      empty="Nothing yet. To claim a listing, open the tool’s page and use “Do you work for…?”."
      items={data?.map((claim) => ({
        key: claim.id,
        title: <InlineLink href={`/tool/${claim.tool}`}>{claim.tool_name}</InlineLink>,
        detail: claim.work_email,
        status: statusOf(CLAIM_STATUS, claim.status),
      }))}
    />
  )
}

function ToolSubmissionSection() {
  const { data } = useListMySubmissions()
  return (
    <ActivitySection
      title="Tools you submitted"
      empty={
        <>
          Nothing yet. Missing a tool? <InlineLink href="/submit">Submit a tool</InlineLink>.
        </>
      }
      items={data?.map((tool) => ({
        key: tool.id,
        title: tool.name,
        detail: tool.homepage_url,
        status: statusOf(TOOL_STATUS, tool.status),
      }))}
    />
  )
}

function ListingSection() {
  const { data } = useListMyListings()
  return (
    <ActivitySection
      title="Listings you maintain"
      more={{ href: '/my-listings', label: 'Manage your listings' }}
      empty="None yet. A listing becomes yours once a claim on it is approved."
      items={data?.map((listing) => ({
        key: listing.slug,
        title: listing.name,
        detail: listing.tagline,
      }))}
    />
  )
}

type Item = { key: string | number; title: ReactNode; detail?: string; status?: Status }

function ActivitySection({
  title,
  items,
  empty,
  more,
}: {
  title: string
  /** Undefined while loading. */
  items: Item[] | undefined
  empty: ReactNode
  more?: { href: string; label: string }
}) {
  return (
    <section aria-label={title}>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          {more && items?.length ? (
            <InlineLink href={more.href} className="text-sm">
              {more.label}
            </InlineLink>
          ) : null}
        </div>
        {items === undefined ? (
          <Skeleton className="h-12 w-full" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  {item.detail ? (
                    <p className="text-muted-foreground truncate text-xs">{item.detail}</p>
                  ) : null}
                </div>
                {item.status ? <Badge tone={item.status.tone}>{item.status.label}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

function InlineLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link href={href} className={`text-foreground font-medium hover:underline ${className ?? ''}`}>
      {children}
    </Link>
  )
}
