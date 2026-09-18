import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A plain semantic table that reads as a list of cards on a narrow screen.
 *
 * Below `md` the header row is hidden and each row becomes a bordered block,
 * with the field name supplied by the cell's own `label`. One DOM either way:
 * a second, card-shaped copy of the same rows would double every figure in the
 * document, and ask a reader's screen reader to hear it twice.
 *
 * The scroller stays for the range in between, where a five-column comparison
 * is a table again but does not always fit.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        role="table"
        className={cn('w-full border-collapse text-left text-sm max-md:block', className)}
        {...props}
      />
    </div>
  )
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      // A `table-caption` inside a `block` table forces an anonymous table box
      // around itself, which lands the caption in its own stray row.
      className={cn('text-muted-foreground mb-3 text-left text-sm max-md:block', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      role="rowgroup"
      // Hidden rather than `sr-only`: each cell carries its own label below
      // `md`, and keeping the header row in the tree as well would have some
      // screen readers announce the field name twice per cell.
      className={cn('border-border border-b max-md:hidden', className)}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      role="rowgroup"
      className={cn(
        'divide-border divide-y max-md:block max-md:space-y-3 max-md:divide-y-0',
        className,
      )}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      role="row"
      className={cn(
        'max-md:border-border align-top max-md:block max-md:rounded-(--radius-card) max-md:border max-md:p-3',
        className,
      )}
      {...props}
    />
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      role="columnheader"
      className={cn('text-muted-foreground px-3 py-2 font-medium', className)}
      {...props}
    />
  )
}

/**
 * `label` is the column's name, shown beside the value once the header row is
 * gone. It is drawn with generated content rather than an element so that it
 * never enters `textContent` - the cost figures are asserted by their text,
 * and a label node would silently prepend itself to every one of them.
 *
 * The row's first cell is its heading and takes no label.
 */
export function TableCell({
  className,
  label,
  ...props
}: ComponentProps<'td'> & { label?: string }) {
  return (
    <td
      role="cell"
      data-label={label}
      className={cn(
        'px-3 py-3 max-md:px-0 max-md:py-1.5',
        label
          ? 'max-md:before:text-muted-foreground max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:before:shrink-0 max-md:before:font-medium max-md:before:content-[attr(data-label)]'
          : 'max-md:block max-md:pb-2',
        className,
      )}
      {...props}
    />
  )
}
