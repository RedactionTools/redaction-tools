'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useListFacets } from '@/lib/api/generated/catalog/catalog'
import {
  useStaffAddToolFacet,
  useStaffGetTool,
  useStaffRemoveToolFacet,
} from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { FacetDimensionOut, StaffToolOut } from '@/lib/api/generated/model'

import { EditorActions } from './editor-actions'
import { useAfterStaffWrite } from './use-staff-write'

/** `dimension/value`, by code: the pair the staff API addresses a facet by. */
type Key = `${string}/${string}`

const keyOf = (dimension: string, value: string): Key => `${dimension}/${value}`

/**
 * The listing's facets, ticked from the taxonomy.
 *
 * Saved as individual adds and removals, because that is what the rows are -
 * and in that order, since the API refuses to take the last value off a
 * required dimension of a live page, and a swap has to pass through holding
 * both.
 */
export function FacetEditor({
  slug,
  dimensions,
  onDone,
}: {
  slug: string
  /** Limit the editor to these dimension codes; all of them when omitted. */
  dimensions?: string[]
  onDone: () => void
}) {
  const { data: record } = useStaffGetTool(slug)
  const { data: taxonomy } = useListFacets()
  if (!record || !taxonomy) return <Skeleton className="h-32 w-full" />

  const shown = dimensions
    ? taxonomy.filter((dimension) => dimensions.includes(dimension.code))
    : taxonomy
  return <Form record={record} taxonomy={shown} onDone={onDone} />
}

function Form({
  record,
  taxonomy,
  onDone,
}: {
  record: StaffToolOut
  taxonomy: FacetDimensionOut[]
  onDone: () => void
}) {
  const inScope = new Set(taxonomy.map((dimension) => dimension.code))
  const initial = new Set(
    record.facets
      .filter((facet) => inScope.has(facet.dimension))
      .map((facet) => keyOf(facet.dimension, facet.value)),
  )
  const [ticked, setTicked] = useState(() => new Set(initial))
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const afterWrite = useAfterStaffWrite(record.slug)
  const add = useStaffAddToolFacet()
  const remove = useStaffRemoveToolFacet()

  const adds = [...ticked].filter((key) => !initial.has(key))
  const removals = [...initial].filter((key) => !ticked.has(key))

  const toggle = (key: Key) =>
    setTicked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  async function save() {
    setPending(true)
    setError(null)
    try {
      for (const key of adds) {
        const [dimension, value] = key.split('/')
        await add.mutateAsync({ slug: record.slug, data: { dimension, value } })
      }
      for (const key of removals) {
        const [dimension, value] = key.split('/')
        await remove.mutateAsync({ slug: record.slug, dimension, value })
      }
      await afterWrite()
      onDone()
    } catch (caught) {
      // Whatever landed before the refusal stays landed, and the re-read shows
      // it: the editor stays open on the reason.
      setError(caught)
      await afterWrite()
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {taxonomy.map((dimension) => (
        <fieldset key={dimension.code} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{dimension.label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {dimension.values.map((value) => {
              const key = keyOf(dimension.code, value.code)
              return (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={ticked.has(key)} onChange={() => toggle(key)} />
                  {value.label}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <EditorActions
        error={error}
        pending={pending}
        disabled={adds.length + removals.length === 0}
        onCancel={onDone}
      />
    </form>
  )
}
