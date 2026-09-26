'use client'

import { type ReactNode, useState } from 'react'

import { cn } from '@/lib/utils'

import { useIsStaff } from './use-is-staff'

/** Where the chip sits on the block's hover outline. */
const PLACEMENT = {
  // The outline's top-right corner - attached to the block it edits.
  edge: '-top-5 -right-5',
  // Tucked inside, for a grid column whose right edge borders its neighbour.
  inside: '-top-5 right-0',
  // Over the corner of something small, like the logo.
  corner: '-top-3 -right-3',
} as const

/**
 * One block of the tool page, editable in place by staff.
 *
 * Everyone else gets `children` exactly as they were - no wrapper element. For
 * staff nothing is laid out either: hovering a block (or tabbing into it)
 * draws an outline around it and reveals a pencil on the outline's corner, both
 * positioned rather than placed, so the page staff edit has the layout readers
 * see. Touch screens cannot hover, so there the pencil always shows.
 *
 * An `empty` block has nothing to outline, so it becomes a dashed placeholder
 * naming what it would hold.
 *
 * Each block edits on its own, so a save is one field's worth of change and
 * one entry in the revision trail.
 */
export function Editable({
  label,
  editor,
  children,
  placement = 'edge',
  empty = false,
}: {
  label: string
  editor: (done: () => void) => ReactNode
  children?: ReactNode
  placement?: keyof typeof PLACEMENT
  empty?: boolean
}) {
  const isStaff = useIsStaff()
  const [editing, setEditing] = useState(false)

  if (!isStaff) return <>{children}</>

  if (editing) {
    return (
      <section
        aria-label={`Editing ${label}`}
        className="border-border bg-surface ring-ring/20 space-y-4 rounded-xl border p-5 shadow-sm ring-4"
      >
        <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <PencilIcon size={12} />
          Editing {label}
        </p>
        {editor(() => setEditing(false))}
      </section>
    )
  }

  if (empty) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={() => setEditing(true)}
        className={cn(
          'border-border text-muted-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-sm transition-colors',
          'hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        )}
      >
        <PlusIcon />
        Add {label}
      </button>
    )
  }

  return (
    <div className="group/editable relative">
      {children}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-2 rounded-xl border border-dashed border-transparent transition-colors',
          'group-focus-within/editable:border-foreground/25 group-hover/editable:border-foreground/25',
        )}
      />
      <button
        type="button"
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        onClick={() => setEditing(true)}
        className={cn(
          'border-border bg-background text-muted-foreground absolute z-10 grid size-7 place-items-center rounded-full border shadow-sm transition',
          'hover:text-foreground hover:scale-110',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          'opacity-0 group-focus-within/editable:opacity-100 group-hover/editable:opacity-100 pointer-coarse:opacity-100',
          PLACEMENT[placement],
        )}
      >
        <PencilIcon size={14} />
      </button>
    </div>
  )
}

function PencilIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
