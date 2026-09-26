'use client'

import { useQueryClient } from '@tanstack/react-query'

import { getGetToolQueryKey } from '@/lib/api/generated/catalog/catalog'
import {
  getStaffGetToolQueryKey,
  getStaffListScreenshotsQueryKey,
} from '@/lib/api/generated/catalog-staff/catalog-staff'

/**
 * What every staff save does afterwards: re-read the page and the staff record.
 *
 * Both, because the public payload is what the page draws and the staff record
 * is what the editors prefill from and what carries listability. An edit that
 * unlists the tool turns the public read into a 404; TanStack keeps the last
 * good data, so the page stays up and the staff panel says why it is unlisted.
 */
export function useAfterStaffWrite(slug: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetToolQueryKey(slug) }),
      queryClient.invalidateQueries({ queryKey: getStaffGetToolQueryKey(slug) }),
      queryClient.invalidateQueries({ queryKey: getStaffListScreenshotsQueryKey(slug) }),
    ])
}
