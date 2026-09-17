import type { ApiError } from '@/lib/api/api-error'

// backend/openapi.json declares no 4xx responses, so Orval types every hook's
// TError as `unknown`. Registering the default error here types them all at
// once, instead of casting at each call site.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
  }
}
