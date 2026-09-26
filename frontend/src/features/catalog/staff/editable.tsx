'use client'

import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useIsStaff } from './use-is-staff'

const PLACEMENT = {
  // In the page's right margin where there is one (the container is max-w-5xl,
  // so from xl up), on the block's first line otherwise.
  gutter: 'top-0 right-0 xl:-right-10',
  // Inside the block's top-right corner, for a block with a neighbour to its
  // right - a grid column - where the margin belongs to someone else.
  inside: 'top-0 right-0',
  // Over the corner of something small, like the logo.
  corner: '-top-2 -right-2',
} as const

/**
 * One block of the tool page, with an edit icon for staff.
 *
 * Everyone else gets `children` exactly as they were - no wrapper element. For
 * staff the icon is positioned over the block rather than laid out after it,
 * so the page they edit has the layout readers see. The exception is an
 * `empty` block, which has nothing to sit on: there the icon takes a line of
 * its own, named, because an icon over nothing says nothing.
 *
 * Each block edits on its own, so a save is one field's worth of change and
 * one entry in the revision trail.
 */
export function Editable({
  label,
  editor,
  children,
  placement = 'gutter',
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
      <div className="border-border rounded-md border border-dashed p-4">
        {editor(() => setEditing(false))}
      </div>
    )
  }

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'text-muted-foreground hover:text-foreground h-7 gap-1.5 px-1.5',
        !empty && ['bg-background/80 absolute z-10 w-7 px-0', PLACEMENT[placement]],
      )}
      aria-label={`Edit ${label}`}
      title={`Edit ${label}`}
      onClick={() => setEditing(true)}
    >
      <PencilIcon />
      {empty ? <span className="text-xs">Add {label}</span> : null}
    </Button>
  )

  if (empty) return button

  return (
    <div className="relative">
      {children}
      {button}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
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
