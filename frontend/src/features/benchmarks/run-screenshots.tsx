'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { RunScreenshotOut } from '@/lib/api/generated/model'

const THUMB_SIZES = '(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw'

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
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {screenshots.map((shot, index) => {
          const name = `Screenshot ${index + 1} of ${screenshots.length}`
          const alt = `${name}, taken while ${label} was run`
          return (
            <li key={shot.url}>
              <Dialog>
                <DialogTrigger
                  aria-label={`Enlarge ${name.toLowerCase()}`}
                  className="border-border block w-full cursor-zoom-in overflow-hidden rounded-md border"
                >
                  {/* Not next/image: the backend already rendered the widths it serves. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.url}
                    srcSet={shot.srcset ? `${shot.srcset}, ${shot.url} ${shot.width}w` : undefined}
                    sizes={THUMB_SIZES}
                    width={shot.width}
                    height={shot.height}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.url} alt={alt} className="mx-auto h-auto max-w-full rounded" />
                </DialogContent>
              </Dialog>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
