/**
 * The header's destinations, in one place: the bar renders them above `md` and
 * the mobile drawer below it, and a link that existed in only one of the two
 * would be a page some readers could never reach.
 */
export const NAV_LINKS = [
  { href: '/price-calculator', label: 'Price calculator' },
  { href: '/docs/methodology', label: 'Methodology' },
  { href: '/blog', label: 'Blog' },
  { href: '/submit', label: 'Submit a tool' },
] as const
