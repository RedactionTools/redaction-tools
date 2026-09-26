import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-border bg-surface placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
