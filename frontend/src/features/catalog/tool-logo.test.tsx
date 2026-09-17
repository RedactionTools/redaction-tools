import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ToolLogo } from './tool-logo'

describe('ToolLogo', () => {
  it('shows the logo when there is one', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="/images/tools/adobe-acrobat.svg" />)

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/tools/adobe-acrobat.svg',
    )
  })

  it('leaves the alt text empty, because the tool name always sits beside it', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="/images/tools/adobe-acrobat.svg" />)

    // A duplicate of the adjacent name would make a screen reader say it twice.
    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '')
  })

  it('lets a logo keep its own aspect ratio', () => {
    // Deliberately asserting on the class: most vendor logos are wordmarks, and
    // constraining one to a square is the specific regression this guards.
    render(<ToolLogo name="Redactable" logoUrl="/images/tools/redactable.svg" />)

    expect(screen.getByRole('presentation')).toHaveClass('w-auto')
  })

  it('falls back to a monogram when no logo is recorded', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="" />)

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('AA')
  })

  it('falls back to a monogram when the image fails to load', () => {
    // Every seeded logo currently points at a file we do not host, so this is
    // the normal path rather than an edge case.
    render(<ToolLogo name="CaseGuard Studio" logoUrl="/images/tools/missing.svg" />)

    fireEvent.error(screen.getByRole('presentation'))

    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('CS')
  })

  it('uses a single initial for a one-word name', () => {
    render(<ToolLogo name="Redactable" logoUrl="" />)

    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('R')
  })

  it('hides the monogram from assistive tech, since it carries no information', () => {
    render(<ToolLogo name="Redactable" logoUrl="" />)

    expect(screen.getByTestId('tool-monogram')).toHaveAttribute('aria-hidden', 'true')
  })
})
