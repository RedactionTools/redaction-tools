'use client'

import type { ReactNode } from 'react'

import { Tooltip } from '@/components/ui/tooltip'

/**
 * The redaction-method facet, keyed by value slug, in the taxonomy's own order.
 *
 * Labels are the taxonomy's (`0004_seed_taxonomy`); list rows carry bare slugs,
 * and four fixed values do not justify fetching the taxonomy to name them.
 */
export const METHODS: { slug: string; label: string; hint: string; icon: ReactNode }[] = [
  {
    slug: 'manual-redaction',
    label: 'Manual',
    hint: 'You mark what to redact by hand',
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  },
  {
    slug: 'ai',
    label: 'AI-powered',
    hint: 'A model finds what to redact',
    icon: (
      <>
        <path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9Z" />
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z" />
      </>
    ),
  },
  {
    slug: 'hybrid',
    label: 'Hybrid',
    hint: 'Found automatically, reviewed by a person',
    icon: (
      <>
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </>
    ),
  },
  {
    slug: 'rule-based',
    label: 'Rule-based',
    hint: 'Patterns and search terms you define',
    icon: (
      <>
        <path d="m3 7 2 2 4-4" />
        <path d="m3 17 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
      </>
    ),
  },
]

export function MethodIcon({ icon }: { icon: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      {icon}
    </svg>
  )
}

/**
 * A tool's redaction methods as icons, each named on hover and to assistive
 * tech. Focusable, so the name reaches a keyboard as well as a mouse; the
 * table's note carries a legend for a touch screen, which has neither.
 */
export function MethodIcons({ slug, facetSlugs }: { slug: string; facetSlugs: string[] }) {
  const methods = METHODS.filter((method) => facetSlugs.includes(method.slug))

  return (
    <span className="flex items-center gap-1" data-testid={`methods-${slug}`}>
      {methods.length ? (
        methods.map((method) => (
          <Tooltip
            key={method.slug}
            content={
              <>
                <span className="font-medium">{method.label}</span> · {method.hint}
              </>
            }
          >
            <span
              role="img"
              aria-label={method.label}
              tabIndex={0}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <MethodIcon icon={method.icon} />
            </span>
          </Tooltip>
        ))
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  )
}

/** Every method icon, named once - the only key a touch screen gets. */
export function MethodLegend() {
  return (
    <ul
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
      aria-label="Redaction methods"
      data-testid="method-legend"
    >
      {METHODS.map((method) => (
        <li key={method.slug} className="flex items-center gap-1.5">
          <span className="bg-muted text-foreground inline-flex size-5 items-center justify-center rounded">
            <MethodIcon icon={method.icon} />
          </span>
          <span>
            <span className="text-foreground font-medium">{method.label}</span> - {method.hint}
          </span>
        </li>
      ))}
    </ul>
  )
}
