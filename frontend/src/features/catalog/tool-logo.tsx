'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

// Height-constrained with a width cap, not a square box. Most vendor logos are
// wordmarks rather than icons - Redactable's is 6.7:1 - and `object-contain`
// inside a square would shrink one to a few illegible pixels tall.
const SIZES = {
  sm: { image: 'h-7 max-w-28', monogram: 'size-8 text-xs' },
  lg: { image: 'h-10 max-w-44', monogram: 'size-14 text-lg' },
} as const

/** First letters of the first two words: "CaseGuard Studio" becomes "CS". */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * A tool's logo, with a monogram when there isn't one.
 *
 * The fallback is the common path rather than an edge case: logos are re-hosted
 * rather than hotlinked, so a listing carries a path we have not filled in yet
 * until someone does. A broken image icon in a comparison table reads as a
 * broken site, while a monogram reads as a tool without a logo - which is what
 * it is.
 *
 * `alt` is empty and the monogram is hidden from assistive tech on purpose: the
 * tool's name is always rendered immediately beside this, so anything here would
 * be read out twice.
 */
export function ToolLogo({
  name,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string
  logoUrl: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const { image, monogram: monogramSize } = SIZES[size]

  if (logoUrl && !failed) {
    return (
      // A light plate behind every logo. Several of these are near-black
      // wordmarks (Nitro is #090B21, Redactable #202020) which disappear
      // entirely against the dark theme; a plate keeps them legible without
      // recolouring anyone's mark, which we have no right to do.
      <span className={cn('inline-flex shrink-0 items-center rounded-sm bg-white p-1', className)}>
        {/* Not next/image: a logo_url may be an absolute vendor URL, which would
            need a remotePatterns entry per vendor, and these are small flat
            images where the optimizer buys close to nothing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          role="presentation"
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(image, 'w-auto object-contain')}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      data-testid="tool-monogram"
      className={cn(
        monogramSize,
        'bg-muted text-muted-foreground flex shrink-0 items-center justify-center',
        'rounded-sm font-semibold tracking-tight',
        className,
      )}
    >
      {monogram(name)}
    </span>
  )
}
