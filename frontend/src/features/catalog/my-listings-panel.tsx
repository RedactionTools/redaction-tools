'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useListMyListings } from '@/lib/api/generated/catalog/catalog'

import { ListingEditor } from './listing-editor'
import { ScreenshotUploader } from './screenshot-uploader'

export function MyListingsPanel() {
  const { data, isPending } = useListMyListings()

  if (isPending || !data) {
    return <Skeleton className="h-40 w-full" data-testid="my-listings-skeleton" />
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground">
        You do not maintain any listings yet. Open the tool&apos;s page and claim it with a work
        email on the vendor&apos;s domain.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Changes you make here are proposals. Each one is reviewed by an editor before it appears on
        the listing, and a published price says that you supplied it.
      </p>

      <ul className="space-y-4">
        {data.map((listing) => (
          <li key={listing.slug}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    <Link href={`/tool/${listing.slug}`} className="hover:underline">
                      {listing.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1">{listing.tagline}</CardDescription>
                </div>
                <Badge tone={listing.status === 'published' ? 'ok' : 'neutral'}>
                  {listing.status}
                </Badge>
              </div>

              <div className="mt-4">
                <ListingEditor listing={listing} />
              </div>

              {/* Beside the editor rather than inside it: a revision is a set of
                  field changes an editor rules on as one, and a picture is a
                  file that arrives, gets rendered and is reviewed on its own. */}
              <div className="border-border mt-6 border-t pt-4">
                <h3 className="mb-3 text-sm font-medium">Screenshots</h3>
                <ScreenshotUploader slug={listing.slug} name={listing.name} />
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* Stating the boundary plainly heads off the support thread. */}
      <p className="text-muted-foreground text-sm" data-testid="owner-readonly-note">
        Our editorial verdict, notes and any benchmark results are set by our own testing and cannot
        be changed here. Neither can a listing&apos;s URL or its publication status.
      </p>
    </div>
  )
}
