import { screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { makeScreenshot } from './fixtures'
import { ToolScreenshots } from './tool-screenshots'

describe('ToolScreenshots', () => {
  it('offers every rendition the API listed, so a phone is not sent the widest', () => {
    renderWithProviders(<ToolScreenshots name="Adobe Acrobat" screenshots={[makeScreenshot()]} />)

    const image = screen.getByAltText('The Acrobat redaction panel with two marks applied')
    expect(image).toHaveAttribute('srcset', makeScreenshot().srcset)
    expect(image).toHaveAttribute('sizes')
  })

  // The dimensions are the whole reason the API ships them: without them the
  // page reflows as each figure arrives, which on a profile full of them is a
  // visible jump under the reader's cursor.
  it('reserves the space a figure will take before it loads', () => {
    renderWithProviders(<ToolScreenshots name="Adobe Acrobat" screenshots={[makeScreenshot()]} />)

    const image = screen.getByAltText('The Acrobat redaction panel with two marks applied')
    expect(image).toHaveAttribute('width', '1600')
    expect(image).toHaveAttribute('height', '900')
  })

  it('says when the interface was captured, because a UI shot goes stale', () => {
    renderWithProviders(<ToolScreenshots name="Adobe Acrobat" screenshots={[makeScreenshot()]} />)

    expect(screen.getByText(/1 September 2026/)).toBeInTheDocument()
  })

  it('renders nothing at all when a listing has no screenshots', () => {
    renderWithProviders(<ToolScreenshots name="Adobe Acrobat" screenshots={[]} />)

    expect(screen.queryByRole('heading', { name: /screenshots/i })).not.toBeInTheDocument()
  })

  it('opens the full-size capture, since the figure on the page is too small to read', async () => {
    renderWithProviders(<ToolScreenshots name="Adobe Acrobat" screenshots={[makeScreenshot()]} />)

    await userEvent.click(screen.getByRole('button', { name: /enlarge/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByAltText(/redaction panel/i)).toBeInTheDocument()
  })
})
