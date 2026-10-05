import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CopyButton } from './copy-button'

describe('CopyButton', () => {
  it('copies its text and says so', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<CopyButton text="hello" label="Copy greeting" />)

    await user.click(screen.getByRole('button', { name: 'Copy greeting' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('hello'))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })
})
