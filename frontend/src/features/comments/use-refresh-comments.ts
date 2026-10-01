'use client'

import { useQueryClient } from '@tanstack/react-query'

/**
 * Re-read every comment query after a write: the page's thread, the author's
 * own pending list and the staff queue all share the `/api/v1/comments` prefix,
 * and any of them can change when one comment does.
 */
export function useRefreshComments() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/v1/comments'),
    })
}
