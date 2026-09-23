'use client'

import Link from 'next/link'
import { useState } from 'react'

import { GitHubLink } from '@/components/layout/github-link'
import { NAV_LINKS } from '@/components/layout/nav-links'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Feather-style glyphs, drawn inline: there is no icon package here (radix-ui
// is the only UI dependency), same call as the theme toggle and the mark in
// the footer.
const MENU = 'M3 6h18M3 12h18M3 18h18'
const CLOSE = 'M6 6l12 12M18 6 6 18'

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

// 44px, because these are the two controls on the page most likely to be hit
// with a thumb.
const CONTROL =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none'
const ROW = 'hover:bg-muted -mx-2 flex min-h-11 items-center gap-2 rounded-md px-2'

/**
 * The header's links on a phone.
 *
 * The bar cannot hold them: a wordmark, three destinations and three controls
 * come to more than 375px of content in a row that does not wrap, and the
 * overflow scrolls the whole page sideways.
 *
 * The drawer's contents are mounted only while it is open, which is what keeps
 * one copy of each link in the document - the bar renders the same
 * `NAV_LINKS` above `md`, and two live copies would be two results for every
 * query that goes looking for one.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger aria-label="Menu" className={cn(CONTROL, '-mr-2 md:hidden')}>
        <Icon d={MENU} />
      </DialogTrigger>

      {/* Radix offers a description slot as well; this menu is four links and
          has nothing to say past its title. */}
      <DialogContent
        aria-describedby={undefined}
        className="border-border fixed inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-6 border-l p-6"
      >
        <div className="flex items-center justify-between">
          <DialogTitle>Menu</DialogTitle>
          <DialogClose aria-label="Close menu" className={cn(CONTROL, '-mr-2')}>
            <Icon d={CLOSE} />
          </DialogClose>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={ROW}
              // Next navigates on the client, so nothing unmounts the drawer on
              // its own: without this it stays open over the page it just
              // opened.
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <GitHubLink label="Source on GitHub" className={ROW} />
        </nav>
      </DialogContent>
    </Dialog>
  )
}
