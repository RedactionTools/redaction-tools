import { describe, expect, it, vi } from 'vitest'

import { collectPages } from './paging'

/** A fake API: `total` rows, handed back `pageSize` at a time. */
function pagedSource(total: number, pageSize: number) {
  return vi.fn(async (page: number) => ({
    count: total,
    items: Array.from(
      { length: Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize)) },
      (_, i) => ({
        id: (page - 1) * pageSize + i,
      }),
    ),
  }))
}

describe('collectPages', () => {
  it('asks once when everything fits on one page', async () => {
    const fetchPage = pagedSource(7, 100)

    expect(await collectPages(fetchPage, { pageSize: 100 })).toHaveLength(7)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('follows to the next page when the count says there is more', async () => {
    const fetchPage = pagedSource(250, 100)

    expect(await collectPages(fetchPage, { pageSize: 100 })).toHaveLength(250)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('walks the pages in order from the first', async () => {
    const fetchPage = pagedSource(250, 100)
    await collectPages(fetchPage, { pageSize: 100 })

    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3])
  })

  it('asks for nothing beyond an exactly full last page', async () => {
    const fetchPage = pagedSource(200, 100)

    expect(await collectPages(fetchPage, { pageSize: 100 })).toHaveLength(200)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  // A crawler-facing route must not be able to spin forever because the API
  // reported a count it cannot actually serve.
  it('stops at the cap rather than trusting a count that never arrives', async () => {
    const fetchPage = vi.fn(async () => ({ count: 1_000_000, items: [{ id: 1 }] }))

    await collectPages(fetchPage, { pageSize: 1, maxPages: 5 })

    expect(fetchPage).toHaveBeenCalledTimes(5)
  })

  it('stops on an empty page even when the count disagrees', async () => {
    const fetchPage = vi.fn(async () => ({ count: 900, items: [] }))

    expect(await collectPages(fetchPage, { pageSize: 100 })).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
