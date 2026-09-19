import posthog from 'posthog-js'

import { isDevelopment, posthogConfig } from '@/lib/analytics'

if (posthogConfig) {
  posthog.init(posthogConfig.key, {
    api_host: posthogConfig.host,
    defaults: '2026-01-30',
    capture_exceptions: true,
  })
} else if (!isDevelopment) {
  // Development is off by design; anywhere else this is a misconfiguration
  // that silently drops every event.
  console.warn(
    'PostHog is not initialised: NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST must both be set.',
  )
}
