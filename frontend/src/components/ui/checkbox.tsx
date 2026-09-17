import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A native checkbox. Radix is not used here: a filter list renders dozens of
 * these, and the native control already gives keyboard behaviour, form
 * semantics and the checked state assistive tech expects.
 */
export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'border-border accent-foreground size-4 shrink-0 rounded-sm border',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
