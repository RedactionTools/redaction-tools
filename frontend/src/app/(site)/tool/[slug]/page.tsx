import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ToolProfile } from '@/features/catalog/tool-profile'
import { getGetToolQueryKey } from '@/lib/api/generated/catalog/catalog'
import { priceSentence } from '@/lib/catalog/format'
import { fetchTool } from '@/lib/catalog/server'
import { clientEnv } from '@/lib/env'
import { getQueryClient } from '@/lib/query/client'
import {
  breadcrumbJsonLd,
  combineJsonLd,
  softwareApplicationJsonLd,
  toolUrl,
} from '@/lib/seo/json-ld'

// Per-request, like the hub: nothing may be fetched during `next build`.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/tool/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const tool = await fetchTool(slug)
  if (!tool) return { title: 'Tool not found' }

  const year = new Date().getUTCFullYear()
  return {
    title: `${tool.name} redaction — pricing and features (${year})`,
    // The description carries the price, its unit and its date, because this is
    // the string a search result or an answer engine quotes verbatim.
    description: priceSentence(tool.name, tool.price_summary),
    alternates: { canonical: `/tool/${tool.slug}` },
  }
}

export default async function ToolPage({ params }: PageProps<'/tool/[slug]'>) {
  const { slug } = await params
  const tool = await fetchTool(slug)
  if (!tool) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetToolQueryKey(slug), tool)

  const site = clientEnv.NEXT_PUBLIC_SITE_URL
  const jsonLd = combineJsonLd([
    softwareApplicationJsonLd(site, tool),
    breadcrumbJsonLd(site, [
      { name: 'Redaction tools', url: `${site}/` },
      { name: tool.name, url: toolUrl(site, tool.slug) },
    ]),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ToolProfile slug={slug} />
    </HydrationBoundary>
  )
}
