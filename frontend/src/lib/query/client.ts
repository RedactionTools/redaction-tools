import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'

import { ApiError } from '@/lib/api/api-error'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Anything prefetched on the server is still fresh on the client, so
        // hydration does not immediately fire the same request again.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // A 401 means "re-authenticate", not "try again".
          if (error instanceof ApiError && error.status < 500) return false
          return failureCount < 2
        },
      },
      mutations: { retry: false },
      dehydrate: {
        // Ship in-flight queries too, so a streamed RSC can start a fetch and
        // the client picks up that promise instead of refetching.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  // A fresh client per server request: caches must never cross users.
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
