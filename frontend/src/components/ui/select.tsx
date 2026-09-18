import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A native select.
 *
 * Deliberately not the radix listbox: this is a form choice, so the platform
 * control brings keyboard behaviour, type-ahead and the mobile picker for free,
 * and it still works before hydration.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-border bg-surface w-full rounded-md border px-3 py-2 text-sm',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
