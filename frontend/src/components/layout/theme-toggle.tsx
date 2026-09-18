'use client'

import { useTheme } from 'next-themes'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Feather-style glyphs, drawn inline: there is no icon package here (radix-ui
// is the only UI dependency), same call as the header's GitHub mark.
const SUN =
  'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4'
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'

function Icon({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

/**
 * The theme control in the header.
 *
 * Three choices rather than a two-state flip: `system` is the default, and a
 * toggle that only alternates light and dark gives no way back to following
 * the OS once you have touched it.
 *
 * The trigger's glyph is swapped with a CSS-only `dark:` toggle, like the logo.
 * next-themes knows nothing until it hydrates, so choosing the icon from
 * `resolvedTheme` would render the wrong one on the server and visibly flip on
 * first paint. The menu's contents may read `theme` freely - Radix mounts them
 * on open, which is long after hydration.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Theme"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Icon className="dark:hidden">
          <circle cx="12" cy="12" r="4" />
          <path d={SUN} />
        </Icon>
        <Icon className="hidden dark:block">
          <path d={MOON} />
        </Icon>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
