import Link from 'next/link'
import type { ReactNode } from 'react'

import { Container } from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { LINKEDIN_URL, REDDIT_URL, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo/site'

// Brand marks, drawn inline: there is no icon package here (radix-ui is the
// only UI dependency), same call as the header's GitHub glyph.
const REDDIT_MARK =
  'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z'
const LINKEDIN_MARK =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

/**
 * An off-site link with its brand mark. The visible text names it, so the mark
 * stays out of the accessibility tree - two names make a screen reader say it
 * twice.
 */
function SocialLink({ href, mark, children }: { href: string; mark: string; children: ReactNode }) {
  return (
    <a
      href={href}
      // Leaving the site, so the tab is new; noreferrer implies noopener, but
      // both are spelled out because the pairing is the well-known one.
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground flex items-center gap-1.5"
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
        <path d={mark} />
      </svg>
      {children}
    </a>
  )
}

export function SiteFooter() {
  // Read at render, not hardcoded, so the footer is not wrong every January.
  // The dynamic routes get the real year; the prerendered ones (/methodology,
  // /submit) carry the year of the build that produced the image.
  const year = new Date().getFullYear()

  return (
    <footer className="border-border mt-16 border-t py-8">
      <Container className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
          <div className="space-y-3">
            {/* The mark is decorative - the wordmark beside it names the link. */}
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Logo size={24} />
              {SITE_NAME}
            </Link>
            <p className="text-muted-foreground max-w-sm text-sm">{SITE_DESCRIPTION}</p>
          </div>
          <nav className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/" className="hover:text-foreground">
              All tools
            </Link>
            <Link href="/methodology" className="hover:text-foreground">
              How we verify prices
            </Link>
            <Link href="/submit" className="hover:text-foreground">
              Submit a tool
            </Link>
            <Link href="/my-listings" className="hover:text-foreground">
              Your listings
            </Link>
            {/* The only discovery path a machine-readable file has is a link to
                it. Not a <Link>: it is a route handler, not a page, so there is
                nothing for the router to prefetch. */}
            <a href="/llms.txt" className="hover:text-foreground">
              llms.txt
            </a>
          </nav>
        </div>
        <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm">
          <p>
            © {year} {SITE_NAME}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <SocialLink href={REDDIT_URL} mark={REDDIT_MARK}>
              r/RedactionTools
            </SocialLink>
            <SocialLink href={LINKEDIN_URL} mark={LINKEDIN_MARK}>
              LinkedIn
            </SocialLink>
          </div>
        </div>
      </Container>
    </footer>
  )
}
