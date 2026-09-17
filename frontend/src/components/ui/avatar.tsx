'use client'

import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

/**
 * Renders a plain <img> internally, so Google's profile host needs no
 * next/image remotePatterns entry. Radix swaps in the fallback automatically
 * when the image errors or is still loading.
 */
export function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image className={cn('size-full object-cover', className)} {...props} />
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted text-muted-foreground flex size-full items-center justify-center text-xs font-medium',
        className,
      )}
      {...props}
    />
  )
}
