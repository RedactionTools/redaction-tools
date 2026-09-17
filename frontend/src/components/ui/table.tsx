import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A plain semantic table. Wrapped in its own horizontal scroller so a wide
 * comparison table never makes the whole page scroll sideways on a phone.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  )
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption className={cn('text-muted-foreground mb-3 text-left text-sm', className)} {...props} />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('border-border border-b', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-border divide-y', className)} {...props} />
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('align-top', className)} {...props} />
}

export function TableHeader({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn('text-muted-foreground px-3 py-2 font-medium', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-3', className)} {...props} />
}
