import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * Someone from the vendor holds an approved claim and maintains this listing.
 *
 * The label says it outright, so a touch screen loses nothing to the hover-only
 * tooltip; the tooltip adds the part a reader might otherwise assume wrongly -
 * that the vendor writes the page unchecked.
 */
export function VendorMaintainedBadge({
  vendor,
  compact = false,
}: {
  vendor: string
  /** Inline green text rather than a pill, for a table row that already has plenty. */
  compact?: boolean
}) {
  const content = `Someone from ${vendor} maintains this listing. Their changes, prices included, are reviewed by our editors before they appear.`
  if (compact) {
    return (
      <Tooltip content={content}>
        <span
          tabIndex={0}
          className="text-ok inline-flex cursor-help items-center gap-1 font-medium whitespace-nowrap"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.6 6.1-4.2 4.2a.75.75 0 0 1-1.06 0L4.4 8.36a.75.75 0 1 1 1.06-1.06l1.41 1.41 3.67-3.67a.75.75 0 1 1 1.06 1.06Z" />
          </svg>
          Vendor-maintained
        </span>
      </Tooltip>
    )
  }
  return (
    <Tooltip content={content}>
      <Badge tone="ok" tabIndex={0} className="cursor-help">
        <span aria-hidden="true" className="mr-1">
          ✓
        </span>
        Vendor-maintained
      </Badge>
    </Tooltip>
  )
}
