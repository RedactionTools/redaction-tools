import { clientEnv } from '@/lib/env'

/**
 * Where the API lives, as seen from here.
 *
 * Under Docker Compose the browser reaches Django at http://localhost:8007
 * while the Next.js container must use http://backend:8007. NEXT_PUBLIC_API_URL
 * is inlined at build time; API_INTERNAL_URL is read at runtime and is
 * undefined in the browser bundle, which is fine because that branch never runs
 * there.
 */
export function serverApiOrigin(): string {
  return process.env.API_INTERNAL_URL || clientEnv.NEXT_PUBLIC_API_URL
}

export function apiOrigin(): string {
  if (typeof window === 'undefined') return serverApiOrigin()
  return clientEnv.NEXT_PUBLIC_API_URL
}
