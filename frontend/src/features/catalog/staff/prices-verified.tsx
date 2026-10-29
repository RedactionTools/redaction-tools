'use client'

import { Button } from '@/components/ui/button'
import { CardDescription } from '@/components/ui/card'
import { errorMessage } from '@/lib/api/error-message'
import { useStaffMarkPricesVerified } from '@/lib/api/generated/catalog-staff/catalog-staff'

import { useAfterStaffWrite } from './use-staff-write'

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Records a price check that found nothing to change. Publishing a new figure
 * stamps the check by itself, so this is for the times every price still matched.
 */
export function PricesVerified({
  slug,
  lastVerifiedAt,
}: {
  slug: string
  lastVerifiedAt: string | null
}) {
  const afterWrite = useAfterStaffWrite(slug)
  const mark = useStaffMarkPricesVerified({ mutation: { onSuccess: () => afterWrite() } })

  return (
    <div className="space-y-2">
      <CardDescription>
        Prices last verified: {lastVerifiedAt ? DATE.format(new Date(lastVerifiedAt)) : 'never'}.
      </CardDescription>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={mark.isPending}
        onClick={() => mark.mutate({ slug })}
      >
        {mark.isPending ? 'Saving…' : 'Mark prices verified today'}
      </Button>
      {mark.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(mark.error, 'The check could not be recorded. Please try again.')}
        </p>
      ) : null}
    </div>
  )
}
