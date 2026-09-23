import Link from 'next/link'

/** Page 1 is the base path itself; `/page/1` only redirects there. */
export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`
}

export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-8 text-sm">
      <div className="flex-1">
        {page > 1 ? (
          <Link href={pageHref(basePath, page - 1)} rel="prev" className="hover:underline">
            <span aria-hidden="true">← </span>Newer posts
          </Link>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex flex-1 justify-end">
        {page < totalPages ? (
          <Link href={pageHref(basePath, page + 1)} rel="next" className="hover:underline">
            Older posts<span aria-hidden="true"> →</span>
          </Link>
        ) : null}
      </div>
    </nav>
  )
}
