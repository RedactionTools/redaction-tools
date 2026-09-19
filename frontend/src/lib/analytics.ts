import posthog from 'posthog-js'

/**
 * Analytics is off in development. Local clicks are not product signal, and
 * with one PostHog project they would land beside real traffic; the flag also
 * frees a developer from having to hold a project token to run the app.
 *
 * `posthogConfig` is the single gate: `instrumentation-client.ts` initialises
 * only when it is set, and every call below no-ops otherwise, so an
 * uninitialised posthog is never called.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

export const isDevelopment = process.env.NODE_ENV === 'development'

export const posthogConfig = !isDevelopment && key && host ? { key, host } : null

export const analyticsEnabled = posthogConfig !== null

type Properties = Record<string, unknown>

export const analytics = {
  capture(event: string, properties?: Properties) {
    if (analyticsEnabled) posthog.capture(event, properties)
  },
  identify(distinctId: string, properties?: Properties) {
    if (analyticsEnabled) posthog.identify(distinctId, properties)
  },
  reset() {
    if (analyticsEnabled) posthog.reset()
  },
  captureException(error: unknown) {
    if (analyticsEnabled) posthog.captureException(error)
  },
}
