import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Logo } from '@/components/layout/logo'

describe('Logo', () => {
  it('ships a light-theme and a dark-theme variant', () => {
    const { container } = render(<Logo />)

    expect(container.querySelectorAll('img')).toHaveLength(2)
  })

  // The wordmark beside the mark names the link, so announcing the image too
  // would say it twice. Hidden from assistive tech, described for crawlers.
  it('names itself for a crawler while staying out of the accessibility tree', () => {
    const { container } = render(<Logo />)

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('alt')).toBe('Redaction Tools logo')
      expect(img.getAttribute('aria-hidden')).toBe('true')
    }
  })

  // The mark is dark navy on transparency and would vanish on the dark theme,
  // so the CSS-only swap is the behaviour worth protecting.
  it('hides the dark-theme variant in light mode and vice versa', () => {
    const { container } = render(<Logo />)
    const [light, dark] = Array.from(container.querySelectorAll('img'))

    expect(light.className).toContain('dark:hidden')
    expect(dark.className).toContain('hidden')
    expect(dark.className).toContain('dark:block')
  })

  it('renders both variants at the requested size', () => {
    const { container } = render(<Logo size={44} />)

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('width')).toBe('44')
      expect(img.getAttribute('height')).toBe('44')
    }
  })
})
