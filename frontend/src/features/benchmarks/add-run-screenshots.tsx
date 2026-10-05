'use client'

import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/error-message'
import { useAddBenchmarkRunScreenshots } from '@/lib/api/generated/benchmarks/benchmarks'
import type { MyRunOut } from '@/lib/api/generated/model'

/** What the backend re-encodes (`catalog/images.py`); anything else it refuses. */
export const SCREENSHOT_ACCEPT = 'image/png,image/jpeg,image/webp'

/**
 * Add screenshots to a run that already exists - the web's `pdfredeval publish-screenshots`.
 * The backend skips an image the run already holds, so picking the same file twice is
 * harmless; on a published run a non-staff account's additions wait for an editor.
 */
export function AddRunScreenshots({
  runId,
  label,
  onAdded,
}: {
  runId: string
  /** What the run is called to the reader, for the control's accessible name. */
  label: string
  onAdded?: (run: MyRunOut) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const add = useAddBenchmarkRunScreenshots({ mutation: { onSuccess: onAdded } })
  const id = `add-screenshots-${runId}`

  return (
    <div className="space-y-1">
      {/* As on the submit page: the native control is what the label names, hidden
          behind a button that matches the rest of the form. */}
      <label htmlFor={id} className="sr-only">
        Add screenshots to {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={SCREENSHOT_ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (picked.length) add.mutate({ runId, data: { screenshots: picked } })
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={add.isPending}
        onClick={() => input.current?.click()}
      >
        {add.isPending ? 'Uploading…' : 'Add screenshots'}
      </Button>
      {add.isError ? (
        <p className="text-warn text-xs" role="alert">
          {errorMessage(add.error, 'Those screenshots did not go through. Try again.')}
        </p>
      ) : null}
    </div>
  )
}
