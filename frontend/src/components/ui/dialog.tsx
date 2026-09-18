'use client'

import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A modal dialog.
 *
 * Modal, unlike the dropdown menu next door, which turns it off on purpose:
 * this one is meant to take the page over, so the focus trap, the scroll lock
 * and the inert background are the point rather than an overreach.
 *
 * Positioning is left to the caller. The only consumer today is the header's
 * mobile menu, which wants an edge drawer rather than a centred box, and a
 * primitive that hard-coded either would be wrong for the other.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-sm font-medium', className)} {...props} />
}

export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      {/* Its own token rather than `black/50`: the scrim is a colour, and the
          colours in this app live in globals.css. `foreground/50` would have
          inverted it to a light wash in dark mode. */}
      <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-50" />
      <DialogPrimitive.Content
        className={cn('bg-surface border-border z-50 shadow-lg', className)}
        {...props}
      />
    </DialogPrimitive.Portal>
  )
}
