import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GoogleAnalytics } from './google-analytics'

/** next/script injects nothing under jsdom, so stand it in with the props it received. */
vi.mock('next/script', () => ({
  default: ({ src, strategy, id, children }: Record<string, string | undefined>) => (
    <script data-testid="next-script" data-src={src} data-strategy={strategy} id={id}>
      {children}
    </script>
  ),
}))

describe('GoogleAnalytics', () => {
  it('renders nothing without a measurement id', () => {
    const { container } = render(<GoogleAnalytics measurementId={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('loads gtag for the id only once the browser is idle', () => {
    const { getAllByTestId } = render(<GoogleAnalytics measurementId="G-TEST" />)
    const scripts = getAllByTestId('next-script')

    expect(scripts.map((script) => script.dataset.strategy)).toEqual(['lazyOnload', 'lazyOnload'])
    expect(scripts[0].dataset.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST')
    expect(scripts[1].textContent).toContain("gtag('config', 'G-TEST')")
  })
})
