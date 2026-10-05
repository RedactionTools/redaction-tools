'use client'

import { Carousel } from '@/components/ui/carousel'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { RunScreenshotOut } from '@/lib/api/generated/model'

/** One slide spans the page column, which tops out around 1024px. */
const SLIDE_SIZES = '(min-width: 1024px) 1024px, 100vw'

/**
 * What the operator saw while making the run: the tool's settings, a warning it raised,
 * its result screen. Evidence for the score beside it, so each one enlarges to full size.
 */
export function RunScreenshots({
  screenshots,
  label,
}: {
  screenshots: RunScreenshotOut[]
  label: string
}) {
  if (!screenshots.length) return null
  return (
    <section id="screenshots" className="scroll-mt-24 space-y-3" data-testid="run-screenshots">
      <h2 className="text-xl font-semibold">Screenshots</h2>
      <p className="text-muted-foreground text-sm">
        Taken while {label} was run: the settings it was given and what it showed.
      </p>
      <Carousel label={`Screenshots of ${label}`} className="w-full">
        {screenshots.map((shot, index) => {
          const name = `Screenshot ${index + 1} of ${screenshots.length}`
          const alt = `${name}, taken while ${label} was run`
          return (
            <Dialog key={shot.url}>
              {/* One frame height for every slide, so a tall capture does not make
                    the controls jump when the reader steps past it. */}
              <DialogTrigger
                aria-label={`Enlarge ${name.toLowerCase()}`}
                className="border-border bg-muted flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-md border sm:aspect-auto sm:h-[min(60vh,32rem)]"
              >
                {/* Not next/image: the backend already rendered the widths it serves. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  srcSet={shot.srcset ? `${shot.srcset}, ${shot.url} ${shot.width}w` : undefined}
                  sizes={SLIDE_SIZES}
                  width={shot.width}
                  height={shot.height}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  className="h-auto max-h-full w-auto max-w-full object-contain"
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
                <img src={shot.url} alt={alt} className="mx-auto h-auto max-w-full rounded" />
              </DialogContent>
            </Dialog>
          )
        })}
      </Carousel>
    </section>
  )
}
