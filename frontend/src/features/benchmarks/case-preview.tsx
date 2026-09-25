'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { PreviewOut } from '@/lib/api/generated/model'

export function previewAlt(caseId: string) {
  return `First page of ${caseId}, as a tool receives it`
}

/**
 * A case's first page, rendered by the backend when the case was published.
 *
 * An image, not the PDF in a frame: media is served `X-Frame-Options: DENY`, and most
 * phones have no inline PDF viewer. Enlarged it is the 150 dpi source, where every
 * planted value is legible - the point of looking at the case before running it.
 */
export function CasePreview({ caseId, preview }: { caseId: string; preview: PreviewOut }) {
  const alt = previewAlt(caseId)
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Enlarge the page of ${caseId}`}
        className="border-border bg-surface block w-full cursor-zoom-in overflow-hidden rounded-md border"
      >
        {/* Not next/image: the backend already rendered the widths it serves. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          srcSet={preview.srcset}
          sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
          width={preview.width}
          height={preview.height}
          alt={alt}
          decoding="async"
          className="h-auto w-full"
        />
      </DialogTrigger>
      <DialogContent className="border-border fixed inset-4 z-50 flex flex-col gap-3 overflow-auto rounded-lg border p-4 sm:inset-8">
        <div className="flex items-start justify-between gap-4">
          <DialogTitle>{alt}</DialogTitle>
          <DialogClose className="text-muted-foreground hover:text-foreground text-sm">
            Close
          </DialogClose>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          width={preview.width}
          height={preview.height}
          alt={alt}
          className="mx-auto h-auto max-w-full rounded"
        />
      </DialogContent>
    </Dialog>
  )
}
