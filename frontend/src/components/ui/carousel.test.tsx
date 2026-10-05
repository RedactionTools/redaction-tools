import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Carousel } from './carousel'

function slides(n: number) {
  return Array.from({ length: n }, (_, i) => <p key={i}>Slide {i + 1}</p>)
}

describe('Carousel', () => {
  it('names itself and each slide by position', () => {
    render(<Carousel label="Screenshots">{slides(3)}</Carousel>)

    const region = screen.getByRole('region', { name: 'Screenshots' })
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    const groups = within(region).getAllByRole('group')
    expect(groups).toHaveLength(3)
    expect(groups[1]).toHaveAccessibleName('2 of 3')
  })

  it('steps through the slides and stops at either end', async () => {
    render(<Carousel label="Screenshots">{slides(2)}</Carousel>)

    const previous = screen.getByRole('button', { name: /previous/i })
    const next = screen.getByRole('button', { name: /next/i })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(previous).toBeDisabled()

    await userEvent.click(next)

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(previous).toBeEnabled()
  })

  it('jumps to a slide from its dot', async () => {
    render(<Carousel label="Screenshots">{slides(3)}</Carousel>)

    await userEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))

    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('follows the arrow keys', async () => {
    render(<Carousel label="Screenshots">{slides(2)}</Carousel>)

    screen.getByRole('region', { name: 'Screenshots' }).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('shows one slide plainly, with no controls', () => {
    render(<Carousel label="Screenshots">{slides(1)}</Carousel>)

    expect(screen.getByText('Slide 1')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
