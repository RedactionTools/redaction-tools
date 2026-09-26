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
        variant="outline"
        size="sm"
        className="mt-1 h-6 px-2 text-xs"
        aria-label={`Edit ${label}`}
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
    </div>
  )
}
