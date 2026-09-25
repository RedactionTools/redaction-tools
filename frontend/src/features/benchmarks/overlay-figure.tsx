'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { OverlayOut } from '@/lib/api/generated/model'

/** The overlays are 910px wide; the WebP renditions below that go to thumbnails. */
const THUMB_SIZES = '(min-width: 640px) 320px, 100vw'

/**
 * Ground truth drawn over a tool's output: green where a value was redacted, red and
 * labelled where it leaked. The thumbnail is the evidence at a glance; enlarged, it is
 * where a reader checks a disputed call value by value.
 */
export function OverlayFigure({ overlay, label }: { overlay: OverlayOut; label: string }) {
  const alt = `Overlay for ${label}: each ground-truth value outlined by outcome`
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Enlarge the overlay for ${label}`}
        className="border-border block w-full cursor-zoom-in overflow-hidden rounded-md border"
      >
        {/* Not next/image: the backend already rendered the widths it serves. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={overlay.url}
          srcSet={overlay.srcset ? `${overlay.srcset}, ${overlay.url} 910w` : undefined}
          sizes={THUMB_SIZES}
          alt={alt}
          loading="lazy"
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
        <p className="text-muted-foreground text-sm">
          Green: redacted. Red, labelled: leaked. Amber: over-redacted. Orange: undecided.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={overlay.url} alt={alt} className="mx-auto h-auto max-w-full rounded" />
      </DialogContent>
    </Dialog>
  )
}
