'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useStaffGetTool,
  useStaffUpdateTool,
} from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { StaffToolOut } from '@/lib/api/generated/model'

import { EditorActions } from './editor-actions'
import { useAfterStaffWrite } from './use-staff-write'

type FieldOf<T> = {
  [K in keyof StaffToolOut]: StaffToolOut[K] extends T ? K : never
}[keyof StaffToolOut]

/**
 * How a field is typed into the page. `lines` is a list of strings edited one
 * per line, which is how an editor thinks of strengths and limitations.
 */
export type FieldSpec =
  | { kind: 'text' | 'multiline'; field: FieldOf<string> }
  | { kind: 'lines'; field: FieldOf<string[]> }
  | { kind: 'number'; field: FieldOf<number> }
  | { kind: 'boolean'; field: FieldOf<boolean> }

/**
 * One field of a listing, prefilled from the staff record rather than the
 * public payload: the record is what `update_tool` compares against, so a
 * field the page renders differently still round-trips exactly.
 */
export function ToolFieldEditor({
  slug,
  label,
  onDone,
  ...spec
}: FieldSpec & { slug: string; label: string; onDone: () => void }) {
  const { data: record } = useStaffGetTool(slug)
  if (!record) return <Skeleton className="h-20 w-full" />
  return <Form record={record} spec={spec as FieldSpec} label={label} onDone={onDone} />
}

function draftOf(record: StaffToolOut, spec: FieldSpec): string | boolean {
  const value = record[spec.field]
  if (spec.kind === 'lines') return (value as string[]).join('\n')
  if (spec.kind === 'boolean') return value as boolean
  return String(value)
}

function valueOf(draft: string | boolean, spec: FieldSpec) {
  if (spec.kind === 'lines') {
    return String(draft)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (spec.kind === 'number') return Number(draft)
  return draft
}

function Form({
  record,
  spec,
  label,
  onDone,
}: {
  record: StaffToolOut
  spec: FieldSpec
  label: string
  onDone: () => void
}) {
  const [draft, setDraft] = useState(() => draftOf(record, spec))
  const afterWrite = useAfterStaffWrite(record.slug)
  const save = useStaffUpdateTool({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })
  const id = `staff-${record.slug}-${spec.field}`
  const unchanged = draft === draftOf(record, spec)

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({
          slug: record.slug,
          data: { changes: { [spec.field]: valueOf(draft, spec) } },
        })
      }}
    >
      {spec.kind === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            id={id}
            checked={Boolean(draft)}
            onChange={(event) => setDraft(event.target.checked)}
          />
          {label}
        </label>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={id}>
            {label}
          </label>
          {spec.kind === 'multiline' || spec.kind === 'lines' ? (
            <Textarea
              id={id}
              rows={spec.kind === 'lines' ? 5 : 8}
              value={String(draft)}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <Input
              id={id}
              type={spec.kind === 'number' ? 'number' : 'text'}
              value={String(draft)}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </div>
      )}
      <EditorActions
        error={save.error}
        pending={save.isPending}
        disabled={unchanged}
        onCancel={onDone}
      />
    </form>
  )
}
