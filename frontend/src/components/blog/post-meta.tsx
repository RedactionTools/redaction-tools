/** "23 September 2026", in UTC so the build machine's zone cannot shift the day. */
const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(day: string): string {
  return DAY.format(new Date(`${day}T00:00:00Z`))
}

export function PostMeta({
  date,
  lastmod,
  readingMinutes,
}: {
  date: string
  lastmod?: string
  readingMinutes: number
}) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      <time dateTime={date}>{formatDay(date)}</time>
      <span aria-hidden="true">·</span>
      <span>{readingMinutes} min read</span>
      {lastmod && lastmod !== date ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Updated <time dateTime={lastmod}>{formatDay(lastmod)}</time>
          </span>
        </>
      ) : null}
    </p>
  )
}
