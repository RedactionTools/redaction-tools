'use client'

import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A short hint on hover or keyboard focus.
 *
 * Carries its own provider so a caller does not need one mounted above it. The
 * trigger must be focusable - a hint only a mouse can reach is one a keyboard
 * or screen-reader user never gets - and nothing essential may live only here,
 * because a touch screen has no hover.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className={cn(
              'bg-foreground text-background z-50 max-w-64 rounded-md px-3 py-1.5 text-xs text-pretty shadow-md',
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
