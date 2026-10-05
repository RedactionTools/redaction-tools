'use client'

import { useState } from 'react'

import { Button, type ButtonProps } from './button'

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  text: string
  /** The accessible name; the visible text is only ever "Copy" or "Copied". */
  label: string
}

/** Copies `text`, then reads "Copied" for two seconds. */
export function CopyButton({
  text,
  label,
  size = 'sm',
  variant = 'ghost',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // No clipboard (insecure context, denied permission): the text is selectable.
        }
      }}
      {...props}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
