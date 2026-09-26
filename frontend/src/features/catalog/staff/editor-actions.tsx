import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/error-message'

const FALLBACK = 'That edit could not be saved. Please try again.'

/** Save, Cancel and whatever the API refused with - the foot of every editor. */
export function EditorActions({
  error,
  pending,
  disabled,
  onCancel,
  saveLabel = 'Save',
}: {
  error: unknown
  pending: boolean
  disabled?: boolean
  onCancel: () => void
  saveLabel?: string
}) {
  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(error, FALLBACK)}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || disabled}>
          {pending ? 'Saving…' : saveLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
