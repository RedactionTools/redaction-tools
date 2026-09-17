import Image from 'next/image'

import { cn } from '@/lib/utils'

/**
 * The shield mark. Decorative by default: the header pairs it with the
 * wordmark, which carries the accessible name.
 *
 * The artwork is dark navy on transparency, so it would disappear against the
 * dark theme. Rather than filter it at runtime, a luminance-remapped variant is
 * swapped in with a CSS-only `dark:` toggle - no JS, so there is no flash on
 * first paint before next-themes hydrates.
 */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  // Both variants are fetched even though only one is painted - CSS `display:
  // none` does not stop a download, and Next preloads eager images. At 30px
  // that is ~1-2KB each after optimisation, which is the accepted cost of a
  // CSS-only theme swap that cannot flash before next-themes hydrates.
  const common = {
    width: size,
    height: size,
    loading: 'eager' as const,
    className: cn(className),
  }

  return (
    <>
      <Image
        {...common}
        alt=""
        src="/images/RedactionToolsLogo.png"
        className={cn(common.className, 'dark:hidden')}
      />
      <Image
        {...common}
        alt=""
        src="/images/RedactionToolsLogo-on-dark.png"
        className={cn(common.className, 'hidden dark:block')}
      />
    </>
  )
}
