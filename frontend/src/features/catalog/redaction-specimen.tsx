import type { CSSProperties, ReactNode } from 'react'

/**
 * A page of a document with its personal details redacted: the hub's one
 * picture, because it is the thing every tool in the catalog exists to produce.
 *
 * Paper in both themes, as the logo plates are: a page is a page, and a
 * redaction bar is dark ink on it. On the dark theme pale bars would read as a
 * highlighter instead.
 *
 * Decorative, so hidden from assistive tech - the heading beside it says what
 * the page is. The bars sweep in once on load, in reading order, as a reader's
 * redaction would; `prefers-reduced-motion` draws them already in place.
 */
export function RedactionSpecimen() {
  let order = 0
  const bar = (width: string) => <Bar width={width} delay={300 + order++ * 140} />

  return (
    <figure
      aria-hidden="true"
      className="border-border shadow-surface w-full max-w-md rounded-xl border bg-white p-6 text-[#142030] select-none"
    >
      <div className="mb-4 flex items-baseline justify-between border-b border-[#e2e6ec] pb-3">
        <span className="text-sm font-semibold">Settlement agreement</span>
        <span className="text-xs text-[#5a6576] tabular-nums">Page 3 of 12</span>
      </div>
      <div className="space-y-3 text-[13px] leading-7 text-[#5a6576]">
        <Line>
          This agreement is made on {bar('6ch')} between {bar('11ch')} (the Claimant), of{' '}
          {bar('16ch')}, and Northwind Logistics Ltd.
        </Line>
        <Line>
          The Claimant&apos;s date of birth is {bar('8ch')} and their national insurance number is{' '}
          {bar('10ch')}.
        </Line>
        <Line>
          A payment of {bar('7ch')} will be made to account {bar('9ch')} within 28 days of
          signature.
        </Line>
      </div>
    </figure>
  )
}

function Line({ children }: { children: ReactNode }) {
  return <p className="text-pretty">{children}</p>
}

function Bar({ width, delay }: { width: string; delay: number }) {
  return (
    <span
      className="redaction-bar inline-block h-[1.05em] rounded-[2px] bg-[#192536] align-[-0.2em]"
      style={{ width, '--redact-delay': `${delay}ms` } as CSSProperties}
    />
  )
}
