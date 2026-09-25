import type { RateOut } from '@/lib/api/generated/model'
import { formatInterval, formatRate } from '@/lib/benchmarks/format'

/**
 * A rate, its 95% interval drawn to scale, and the counts behind it.
 *
 * The interval is drawn rather than only printed because it is what decides whether
 * two tools differ at all: 22% out of 54 and 30% out of 54 overlap, and a table of
 * bare percentages hides that.
 */
export function RateCell({ rate }: { rate: RateOut }) {
  const [low, high] = rate.ci95 ?? [0, 0]
  return (
    <div className="min-w-32 space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{formatRate(rate)}</span>
        <span className="text-muted-foreground text-xs tabular-nums">{formatInterval(rate)}</span>
      </div>
      {rate.ci95 && rate.value !== null ? (
        <svg viewBox="0 0 100 6" className="h-1.5 w-full" aria-hidden="true">
          <rect x="0" y="2" width="100" height="2" className="fill-muted" />
          <rect
            x={low * 100}
            y="1"
            width={Math.max((high - low) * 100, 0.5)}
            height="4"
            rx="1"
            className="fill-muted-foreground/50"
          />
          <rect
            x={rate.value * 100 - 0.75}
            y="0"
            width="1.5"
            height="6"
            className="fill-foreground"
          />
        </svg>
      ) : null}
      <p className="text-muted-foreground text-xs tabular-nums">
        {rate.n ? `${rate.count} of ${rate.n}` : 'not measured'}
      </p>
    </div>
  )
}
