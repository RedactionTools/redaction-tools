import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Logo } from '@/components/layout/logo'

describe('Logo', () => {
  it('ships a light-theme and a dark-theme variant', () => {
    render(<Logo />)

    const images = screen.getAllByRole('presentation', { hidden: true })
    expect(images).toHaveLength(2)
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
