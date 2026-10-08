'use client'

import { Button } from '@/components/ui/button'
import { CardDescription } from '@/components/ui/card'
import { errorMessage } from '@/lib/api/error-message'
import { useStaffSendBadgeSuggestion } from '@/lib/api/generated/catalog-staff/catalog-staff'

/**
 * Emails a listing's maintainers its three badges and a link to "your listings",
 * where they copy the snippet.
 *
 * Only for a listing someone maintains: that page is theirs alone, so a mail
 * pointing anyone else at it would lead nowhere.
 */
export function BadgeSuggestion({ slug, maintainers }: { slug: string; maintainers: string[] }) {
  const send = useStaffSendBadgeSuggestion()

  return (
    <div className="space-y-2">
      <CardDescription>Maintained by {maintainers.join(', ')}.</CardDescription>
      {send.data ? (
        <p className="text-sm" role="status">
          Badge suggestion sent to {send.data.sent_to.join(', ')}.
        </p>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={send.isPending}
          onClick={() => send.mutate({ slug })}
        >
          {send.isPending ? 'Sending…' : 'Email badge suggestion'}
        </Button>
      )}
      {send.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(send.error, 'The email could not be sent. Please try again.')}
        </p>
      ) : null}
    </div>
  )
}
