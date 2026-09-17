import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { resetTokenSource } from '@/lib/api/token-source'

// jsdom implements neither pointer capture nor scrollIntoView, both of which
// Radix's popper-based components (dropdown menus) call while opening. Without
// these the trigger silently never opens and assertions fail with a confusing
// "unable to find" rather than an error.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// NEXT_PUBLIC_* is inlined at build time, so tests have to stub it explicitly.
vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8007')
vi.stubEnv('AUTH_GOOGLE_ID', 'test-google-client-id')

beforeEach(() => {
  resetTokenSource()
})

afterEach(() => {
  cleanup()
})
