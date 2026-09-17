'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

/** "Ada Lovelace" -> "AL"; falls back to the email's first letter. */
function initials(name?: string | null, email?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (email ?? '?').slice(0, 1).toUpperCase()
}

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <Skeleton className="size-8 rounded-full" />

  // A session whose token exchange or refresh failed cannot call the API, so
  // treat it as signed out rather than showing a menu that does not work.
  if (!session || session.error) {
    return (
      <Button size="sm" onClick={() => void signIn('google')}>
        Sign in
      </Button>
    )
  }

  const { name, email, image } = session.user ?? {}

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Avatar>
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium">{name || 'Signed in'}</span>
          {email ? (
            <span className="text-muted-foreground block truncate text-xs">{email}</span>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
