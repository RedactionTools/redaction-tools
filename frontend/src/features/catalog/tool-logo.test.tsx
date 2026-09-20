import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ToolLogo } from './tool-logo'

/**
 * The image is hidden from assistive tech, so it has no role to query by - the
 * alt text exists for crawlers and is deliberately never announced.
 */
const logoImage = () => {
  const img = document.querySelector('img')
  if (!img) throw new Error('no logo image rendered')
  return img
}
const queryLogoImage = () => document.querySelector('img')

describe('ToolLogo', () => {
  // The tool's name is always rendered immediately beside this, so announcing
  // the logo too would read the name twice. `aria-hidden` keeps it out of the
  // accessibility tree while leaving the alt text in the markup for crawlers -
  // the one attribute cannot otherwise serve both readers.
  it('stays out of the accessibility tree, because the name is already beside it', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="/images/tools/adobe-acrobat.svg" />)

    expect(logoImage()).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the logo when there is one', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="/images/tools/adobe-acrobat.svg" />)

    expect(logoImage()).toHaveAttribute('src', '/images/tools/adobe-acrobat.svg')
  })

  it('describes the logo for a crawler that has only the markup', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="/images/tools/adobe-acrobat.svg" />)

    // A duplicate of the adjacent name would make a screen reader say it twice.
    expect(logoImage()).toHaveAttribute('alt', 'Adobe Acrobat logo')
  })

  it('lets a logo keep its own aspect ratio', () => {
    // Deliberately asserting on the class: most vendor logos are wordmarks, and
    // constraining one to a square is the specific regression this guards.
    render(<ToolLogo name="Redactable" logoUrl="/images/tools/redactable.svg" />)

    expect(logoImage()).toHaveClass('w-auto')
  })

  it('falls back to a monogram when no logo is recorded', () => {
    render(<ToolLogo name="Adobe Acrobat" logoUrl="" />)

    expect(queryLogoImage()).not.toBeInTheDocument()
    expect(screen.getByTestId('tool-monogram')).toHaveTextContent('AA')
  })

  it('falls back to a monogram when the image fails to load', () => {
    // Every seeded logo currently points at a file we do not host, so this is
    // the normal path rather than an edge case.
    render(<ToolLogo name="CaseGuard Studio" logoUrl="/images/tools/missing.svg" />)

    fireEvent.error(logoImage())

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
