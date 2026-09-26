'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { useStaffGetTool } from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { StaffToolOut } from '@/lib/api/generated/model'

import { Editable } from './editable'
import { type FieldSpec, ToolFieldEditor } from './tool-field-editor'
import { useIsStaff } from './use-is-staff'

type Row = FieldSpec & { label: string; show: (record: StaffToolOut) => string }

/**
 * Everything staff edit that the public page never draws. Without this card
 * the editor's notes, the summary and the sort order would have no place on
 * the page to be edited from.
 */
const ROWS: Row[] = [
  { kind: 'multiline', field: 'summary', label: 'Summary', show: (r) => r.summary },
  {
    kind: 'multiline',
    field: 'editor_verdict',
    label: 'Editor verdict',
    show: (r) => r.editor_verdict,
  },
  { kind: 'multiline', field: 'editor_notes', label: 'Editor notes', show: (r) => r.editor_notes },
  { kind: 'text', field: 'website_url', label: 'Website', show: (r) => r.website_url },
  { kind: 'text', field: 'pricing_url', label: 'Pricing page', show: (r) => r.pricing_url },
  { kind: 'text', field: 'docs_url', label: 'Documentation', show: (r) => r.docs_url },
  { kind: 'number', field: 'sort_order', label: 'Sort order', show: (r) => String(r.sort_order) },
  {
    kind: 'boolean',
    field: 'is_first_party',
    label: 'Our own product',
    show: (r) => (r.is_first_party ? 'Yes' : 'No'),
  },
]

export function StaffPanel({ slug }: { slug: string }) {
  const isStaff = useIsStaff()
  const { data: record } = useStaffGetTool(slug, { query: { enabled: isStaff } })
  if (!isStaff || !record) return null

  return (
    <Card className="space-y-4" data-testid="staff-panel">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Staff</CardTitle>
        <Badge tone="neutral">{record.status}</Badge>
        {record.listable ? <Badge tone="ok">Listed</Badge> : <Badge tone="warn">Not listed</Badge>}
      </div>

      {record.listable ? null : (
        <div role="status" className="space-y-1">
          <CardDescription>
            This listing is not listed: readers get a 404 until these are fixed.
          </CardDescription>
          <ul className="list-disc pl-5 text-sm">
            {record.listability_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {record.open_revisions || record.open_price_proposals ? (
        <CardDescription>
          Waiting in the admin: {record.open_revisions} edit proposals,{' '}
          {record.open_price_proposals} price proposals.
        </CardDescription>
      ) : null}

      <dl className="space-y-3 text-sm">
        {ROWS.map(({ show, ...row }) => (
          <Editable
            key={row.field}
            label={row.label.toLowerCase()}
            placement="inside"
            editor={(done) => <ToolFieldEditor slug={slug} onDone={done} {...row} />}
          >
            <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-words whitespace-pre-line">{show(record) || '—'}</dd>
            </div>
          </Editable>
        ))}
      </dl>
    </Card>
  )
}
