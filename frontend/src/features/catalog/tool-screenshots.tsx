'use client'

import { useState } from 'react'

import { Carousel } from '@/components/ui/carousel'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { ToolScreenshotOut } from '@/lib/api/generated/model'

/**
 * What the reader is deciding between: one capture at a time, in a carousel.
 *
 * `sizes` is not decoration. The API ships the same picture at four widths, and
 * without telling the browser how wide the figure will actually be it assumes
 * the full viewport and downloads the largest of them - which is the opposite of
 * the point. One slide fills a page column that tops out around 768px.
 */
const SIZES = '(min-width: 768px) 768px, 100vw'

/** "1 September 2026" - the same wording as the price dates elsewhere. */
function capturedOn(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date))
}

export function ToolScreenshots({
  name,
  screenshots,
}: {
  name: string
  screenshots: ToolScreenshotOut[]
}) {
  // A listing with no pictures renders no heading rather than an empty one: a
  // "Screenshots" section above nothing reads as a page that failed to load.
  const [enlarged, setEnlarged] = useState<ToolScreenshotOut | null>(null)
  if (screenshots.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Screenshots</h2>
      <Carousel label={`${name} screenshots`} className="w-full" data-testid="screenshots">
        {screenshots.map((shot) => (
          <figure key={shot.url} className="w-full space-y-2">
            {/* One frame height for every slide, so a portrait capture does not
                  make the controls jump when the reader steps past it. */}
            <button
              type="button"
              onClick={() => setEnlarged(shot)}
              aria-label={`Enlarge: ${shot.alt}`}
              className="border-border bg-muted flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md border sm:aspect-auto sm:h-[min(60vh,28rem)]"
            >
              {/* Not next/image: these are already rendered at four widths by
                    the backend that stores them, so a second optimizer in front
                    would re-encode WebP into WebP for nothing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                srcSet={shot.srcset}
                sizes={SIZES}
                width={shot.width}
                height={shot.height}
                alt={shot.alt}
                loading="lazy"
                decoding="async"
                className="h-auto max-h-full w-auto max-w-full object-contain"
              />
            </button>
            {shot.caption || shot.captured_at ? (
              <figcaption className="text-muted-foreground text-sm">
                {shot.caption}
                {shot.caption && shot.captured_at ? ' · ' : null}
                {/* Dated on purpose: an interface changes under a screenshot
                      without anything telling the reader it has. */}
                {shot.captured_at ? `Captured ${capturedOn(shot.captured_at)}` : null}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </Carousel>

      <Dialog open={enlarged !== null} onOpenChange={(open) => !open && setEnlarged(null)}>
        {enlarged ? (
          <DialogContent className="border-border fixed inset-4 z-50 flex flex-col gap-3 overflow-auto rounded-lg border p-4 sm:inset-8">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle>{`${name}: ${enlarged.alt}`}</DialogTitle>
              <DialogClose className="text-muted-foreground hover:text-foreground text-sm">
                Close
              </DialogClose>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlarged.url}
              srcSet={enlarged.srcset}
              // Full width here, which is what makes opening it worth doing:
              // the figure on the page is too small to read a UI label in.
              sizes="100vw"
              width={enlarged.width}
              height={enlarged.height}
              alt={enlarged.alt}
              className="h-auto w-full rounded"
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}
