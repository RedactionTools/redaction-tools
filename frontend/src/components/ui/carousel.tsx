'use client'

import { Children, type ReactNode, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * One slide at a time, for pictures whose heights differ - in a grid, a tall one leaves
 * its neighbour floating above a gap.
 *
 * A scroll-snapped track rather than a transform: a phone swipes it natively, and it
 * needs no library. The buttons, dots and arrow keys scroll that same track, and its
 * scroll position is what says which slide is showing.
 */
export function Carousel({
  label,
  children,
  className,
  ...rest
}: {
  /** What the slides are, for the region's accessible name. */
  label: string
  children: ReactNode
  className?: string
  'data-testid'?: string
}) {
  const slides = Children.toArray(children)
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = slides.length

  function go(to: number) {
    const target = Math.max(0, Math.min(count - 1, to))
    setIndex(target)
    const el = track.current
    // Optional: jsdom has no scrolling, and the index above is already right.
    el?.scrollTo?.({ left: target * el.clientWidth, behavior: 'smooth' })
  }

  if (count === 0) return null

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      {...rest}
      tabIndex={count > 1 ? 0 : undefined}
      className={cn(
        'focus-visible:ring-ring space-y-3 rounded-md outline-none focus-visible:ring-2',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          go(index + 1)
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          go(index - 1)
        }
      }}
    >
      <div
        ref={track}
        className="flex snap-x snap-mandatory [scrollbar-width:none] items-center overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget
          if (clientWidth) setIndex(Math.round(scrollLeft / clientWidth))
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            // Nothing on a slide may change with `index`: toggling `inert` on the
            // off-screen ones made Chrome re-snap the track to the slide it was on,
            // cancelling the smooth scroll `go` had just started. Tabbing to an
            // off-screen slide scrolls it in, and `onScroll` follows.
            className="flex w-full shrink-0 snap-center justify-center"
          >
            {slide}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <ArrowButton direction="previous" disabled={index === 0} onClick={() => go(index - 1)} />
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index || undefined}
                onClick={() => go(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'bg-foreground w-5' : 'bg-border hover:bg-muted-foreground w-2',
                )}
              />
            ))}
          </div>
          <ArrowButton
            direction="next"
            disabled={index === count - 1}
            onClick={() => go(index + 1)}
          />
          <span className="text-muted-foreground w-12 text-xs tabular-nums" aria-live="polite">
            {index + 1} / {count}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'next' ? 'Next slide' : 'Previous slide'}
      disabled={disabled}
      onClick={onClick}
      className="border-border hover:bg-muted inline-flex size-8 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path
          d={direction === 'next' ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
