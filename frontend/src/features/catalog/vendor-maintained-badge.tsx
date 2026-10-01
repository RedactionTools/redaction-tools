import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'

/**
 * Someone from the vendor holds an approved claim and maintains this listing.
 *
 * The label says it outright, so a touch screen loses nothing to the hover-only
 * tooltip; the tooltip adds the part a reader might otherwise assume wrongly -
 * that the vendor writes the page unchecked.
 */
export function VendorMaintainedBadge({ vendor }: { vendor: string }) {
  return (
    <Tooltip
      content={`Someone from ${vendor} maintains this listing. Their changes, prices included, are reviewed by our editors before they appear.`}
    >
      <Badge tone="ok" tabIndex={0} className="cursor-help">
        <span aria-hidden="true" className="mr-1">
          ✓
        </span>
        Vendor-maintained
      </Badge>
    </Tooltip>
  )
}
