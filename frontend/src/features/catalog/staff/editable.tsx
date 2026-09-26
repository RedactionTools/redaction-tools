'use client'

import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'

import { useIsStaff } from './use-is-staff'

/**
 * One block of the tool page, with an edit button for staff.
 *
 * Everyone else gets `children` exactly as they were - no wrapper element, so
 * the public page's markup does not change shape for a feature it cannot use.
 * Each block edits on its own, so a save is one field's worth of change and
 * one entry in the revision trail.
 */
export function Editable({
  label,
  editor,
  children,
}: {
  label: string
  editor: (done: () => void) => ReactNode
  children?: ReactNode
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

  return (
    <div className="group relative">
      {children}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground mt-1 size-7 px-0"
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        onClick={() => setEditing(true)}
      >
        <PencilIcon />
      </Button>
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
