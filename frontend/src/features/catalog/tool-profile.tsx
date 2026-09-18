'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGetTool } from '@/lib/api/generated/catalog/catalog'
import type { PlanOut, ToolDetailOut } from '@/lib/api/generated/model'
import { basePrice, overagePrice } from '@/lib/catalog/document-cost'
import { formatAmount, formatUnit, priceSentence } from '@/lib/catalog/format'

import { ClaimListing } from './claim-listing'
import { DocumentCostCalculator } from './document-cost-calculator'
import { PriceProvenanceBadge } from './price-provenance-badge'
import { ToolLogo } from './tool-logo'

const MEDIA = new Set(['pdf', 'image', 'video', 'audio', 'text'])
const DEPLOYMENT = new Set(['online', 'desktop', 'self-hosted', 'api-tools', 'browser-extension'])
const METHOD = new Set(['manual-redaction', 'ai', 'hybrid', 'rule-based'])

/** The plan's own published figure, shared with the cost calculator so the two
 *  tables can never quote the same plan differently. */
export function planPrice(plan: PlanOut): string {
  const price = basePrice(plan)
  if (price) return `${formatAmount(price.amount, price.currency)} ${formatUnit(price.unit)}`
  if (plan.is_trial && plan.trial_days) return `${plan.trial_days}-day trial`
  if (plan.is_enterprise_quote) return 'Contact sales'
  if (plan.is_free_tier) return 'Free'
  return 'Not published'
}

/**
 * What the plan charges past its allowance, when it meters.
 *
 * Shown wherever the plan's own price is: a metered plan is two published
 * figures, and quoting only the fee is how a comparison table understates it.
 */
export function planOverage(plan: PlanOut): string | null {
  const price = overagePrice(plan)
  if (!price) return null
  return `then ${formatAmount(price.amount, price.currency)} ${formatUnit(price.unit)}`
}

export function ToolProfile({ slug }: { slug: string }) {
  const { data: tool, isPending } = useGetTool(slug)

  if (isPending || !tool) {
    return <Skeleton className="h-96 w-full" data-testid="tool-profile-skeleton" />
  }

  return (
    <article className="space-y-10">
      <ToolHeader tool={tool} />
      <KeyFacts tool={tool} />
      <Capabilities tool={tool} />
      <PlanTable tool={tool} />
      <DocumentCostCalculator tool={tool} />
      <Editorial tool={tool} />
      {/* Last, because the page is written for a buyer: the vendor who came to
          correct it will read to the end, and a buyer should not meet a vendor
          call to action before the assessment. */}
      <ClaimListing tool={tool} />
    </article>
  )
}

function ToolHeader({ tool }: { tool: ToolDetailOut }) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ToolLogo name={tool.name} logoUrl={tool.logo_url} size="lg" />
        <div>
          <p className="text-muted-foreground text-sm">{tool.vendor.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {tool.name}: pricing, features and limits
          </h1>
        </div>
      </div>
      <p className="text-lg text-pretty">{tool.tagline}</p>

      {/* The GEO payload: the same facts the table holds, stated as a sentence,
          because models quote sentences rather than cells. */}
      <p className="font-medium">{priceSentence(tool.name, tool.price_summary)}</p>

      {tool.is_first_party ? (
        <p className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
          This is our own product. It appears in this catalog on the same terms as every other
          entry, is never sorted to the top, and its pricing is recorded the same way.
        </p>
      ) : null}
    </header>
  )
}

function KeyFacts({ tool }: { tool: ToolDetailOut }) {
  const facets = (allowed: Set<string>) =>
    tool.facet_slugs.filter((slug) => allowed.has(slug)).join(', ') || 'Not recorded'

  const summary = tool.price_summary
  const facts: [string, string][] = [
    ['Vendor', tool.vendor.name],
    ['Headquarters', tool.vendor.hq_country || 'Not recorded'],
    ['Media', facets(MEDIA)],
    ['Deployment', facets(DEPLOYMENT)],
    ['Method', facets(METHOD)],
    ['Free tier', summary.has_free_tier ? 'Yes' : 'No'],
    ['Trial', summary.is_trial && summary.trial_days ? `${summary.trial_days}-day trial` : 'None'],
    [
      'Entry price',
      summary.from_amount && summary.currency && summary.unit
        ? `${formatAmount(summary.from_amount, summary.currency)} ${formatUnit(summary.unit)}`
        : 'Not published',
    ],
  ]

  return (
    <Card>
      <CardTitle>Key facts</CardTitle>
      <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="key-facts">
        {facts.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/**
 * What the tool can actually do.
 *
 * The capability facets are the part of a listing a buyer is shortlisting on -
 * whether it OCRs, whether it truly removes content rather than drawing over
 * it - and they are recorded per tool with an editor behind each one. Rendered
 * from the API's labels rather than a slug map here, so the taxonomy has one
 * home.
 */
function Capabilities({ tool }: { tool: ToolDetailOut }) {
  const capabilities = tool.facets.filter((facet) => facet.dimension === 'capability')
  if (capabilities.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">What it does</h2>
      <ul className="flex flex-wrap gap-2" data-testid="capabilities">
        {capabilities.map((facet) => (
          <li key={facet.slug}>
            <Badge tone="neutral">{facet.label}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PlanTable({ tool }: { tool: ToolDetailOut }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Plans and pricing</h2>
      <div data-testid="plan-table">
        <Table>
          <TableCaption>{tool.name} plans. Every figure records where it came from.</TableCaption>
          <TableHead>
            <TableRow>
              <TableHeader>Plan</TableHeader>
              <TableHeader>Price</TableHeader>
              <TableHeader>Includes</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {tool.plans.map((plan) => (
              <TableRow key={plan.code} data-testid={`plan-row-${plan.code}`}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell label="Price">
                  <span className="flex flex-wrap items-center gap-2">
                    {planPrice(plan)}
                    {basePrice(plan) ? (
                      <PriceProvenanceBadge
                        summary={{ ...tool.price_summary, source: basePrice(plan)!.source }}
                        slug={`${tool.slug}-${plan.code}`}
                      />
                    ) : null}
                  </span>
                  {planOverage(plan) ? (
                    <span className="text-muted-foreground block text-xs">{planOverage(plan)}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground" label="Includes">
                  {plan.highlights.join(' · ') || '—'}
                  {plan.limits.length ? (
                    <ul className="mt-1 list-none space-y-0.5">
                      {plan.limits.map((limit) => (
                        <li key={`${limit.kind}-${limit.label}`}>
                          {limit.label}: {limit.display}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProvenanceLegend tool={tool} />
    </section>
  )
}

function ProvenanceLegend({ tool }: { tool: ToolDetailOut }) {
  return (
    <p className="text-muted-foreground text-sm" data-testid="provenance-legend">
      <span aria-hidden="true">⟳</span> read automatically from the vendor ·{' '}
      <span aria-hidden="true">✎</span> entered by our editors · <span aria-hidden="true">🏷</span>{' '}
      supplied by the vendor and not independently verified.
      {tool.pricing_url ? (
        <>
          {' '}
          Check the{' '}
          <a className="underline" href={tool.pricing_url} rel="nofollow noreferrer">
            vendor&apos;s pricing page
          </a>
          .
        </>
      ) : null}
    </p>
  )
}

function Editorial({ tool }: { tool: ToolDetailOut }) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Our assessment</h2>
        {tool.description_md.split('\n\n').map((paragraph, index) => (
          <p key={index} className="text-pretty">
            {paragraph}
          </p>
        ))}
      </div>

      {tool.pros.length || tool.cons.length ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <PointList title="Strengths" points={tool.pros} tone="ok" />
          <PointList title="Limitations" points={tool.cons} tone="warn" />
        </div>
      ) : null}

      {/* Vendor copy is fenced and labelled, so the page's primary content stays
          editorial rather than quietly becoming syndicated marketing. */}
      {tool.vendor_copy_md ? (
        <Card data-testid="vendor-copy">
          <CardTitle>From the vendor</CardTitle>
          <p className="text-muted-foreground mt-2 text-sm">{tool.vendor_copy_md}</p>
        </Card>
      ) : null}
    </section>
  )
}

function PointList({
  title,
  points,
  tone,
}: {
  title: string
  points: string[]
  tone: 'ok' | 'warn'
}) {
  if (points.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        <Badge tone={tone}>{title}</Badge>
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  )
}
