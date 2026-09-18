'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api/error-message'
import { useListFacets, useProposeToolRevision } from '@/lib/api/generated/catalog/catalog'
import type { MyListingOut } from '@/lib/api/generated/model'

/**
 * What an owner may propose a change to.
 *
 * Mirrors `OWNER_EDITABLE_FIELDS` in the backend, which is the boundary that
 * actually holds: anything else is refused there by name. Keeping the same set
 * here means an owner is not offered a field their proposal would be rejected
 * for touching.
 */
const FIELDS = [
  { name: 'name', label: 'Name' },
  { name: 'tagline', label: 'Tagline' },
  { name: 'summary', label: 'Summary', multiline: true },
  { name: 'website_url', label: 'Website' },
  { name: 'pricing_url', label: 'Pricing page' },
  { name: 'docs_url', label: 'Documentation' },
  { name: 'logo_url', label: 'Logo URL' },
  { name: 'vendor_copy_md', label: 'From the vendor', multiline: true },
] as const satisfies readonly { name: keyof MyListingOut; label: string; multiline?: boolean }[]

const FALLBACK = 'That edit could not be sent. Please try again.'

type Draft = Record<string, string>

/**
 * Only what the owner actually altered: every field named in a revision is a
 * field an editor has to rule on, and one the API snapshots for conflicts.
 *
 * Facets are the exception to "field": they travel as the whole list, because
 * that is what applying one replaces.
 */
function changesIn(draft: Draft, facets: string[], listing: MyListingOut) {
  const changes: Record<string, string | string[]> = Object.fromEntries(
    FIELDS.map((field) => [field.name, draft[field.name]]).filter(
      ([name, value]) => value !== String(listing[name as keyof MyListingOut] ?? ''),
    ),
  )

  if (facets.join() !== [...listing.facet_slugs].sort().join()) {
    changes.facet_slugs = facets
  }
  return changes
}

function draftOf(listing: MyListingOut): Draft {
  return Object.fromEntries(FIELDS.map((field) => [field.name, String(listing[field.name] ?? '')]))
}

/**
 * An owner's editor for one listing.
 *
 * Owners propose, editors dispose: nothing here writes to the listing. The
 * form's job is to produce the smallest honest set of changes and to say
 * plainly that a person reads them.
 */
export function ListingEditor({ listing }: { listing: MyListingOut }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftOf(listing))
  const [facets, setFacets] = useState<string[]>(() => [...listing.facet_slugs].sort())
  const { data: taxonomy } = useListFacets()
  const propose = useProposeToolRevision()
  const changes = changesIn(draft, facets, listing)

  // No query invalidation on success: a revision changes nothing about the
  // listing, so re-fetching it would only redraw the same row.
  if (propose.isSuccess) {
    return (
      <p className="text-ok text-sm" role="status">
        Sent for review. Your listing is unchanged until an editor applies it - we will email you
        either way.
      </p>
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Propose an edit
      </Button>
    )
  }

  return (
    <form
      className="max-w-xl space-y-4"
      aria-label={`Propose an edit to ${listing.name}`}
      onSubmit={(event) => {
        event.preventDefault()
        propose.mutate({ slug: listing.slug, data: { changes } })
      }}
    >
      {FIELDS.map((field) => (
        <div key={field.name} className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`${listing.slug}-${field.name}`}>
            {field.label}
          </label>
          {'multiline' in field && field.multiline ? (
            <textarea
              id={`${listing.slug}-${field.name}`}
              rows={3}
              className="border-border bg-surface w-full rounded-md border px-3 py-2 text-sm"
              value={draft[field.name]}
              onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
            />
          ) : (
            <Input
              id={`${listing.slug}-${field.name}`}
              value={draft[field.name]}
              onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
            />
          )}
        </div>
      ))}

      {/* The taxonomy as the catalog holds it: a vendor picks from it rather
          than inventing a label, which is what keeps a filter meaning the same
          thing across every listing it returns. */}
      {taxonomy?.map((dimension) => (
        <fieldset key={dimension.code} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{dimension.label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {dimension.values.map((value) => (
              <label key={value.slug} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={facets.includes(value.slug)}
                  onChange={() =>
                    setFacets((current) =>
                      current.includes(value.slug)
                        ? current.filter((slug) => slug !== value.slug)
                        : [...current, value.slug].sort(),
                    )
                  }
                />
                {value.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {propose.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(propose.error, FALLBACK)}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={propose.isPending || Object.keys(changes).length === 0}>
          {propose.isPending ? 'Sending…' : 'Send for review'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Dropped rather than kept: a draft that outlives the form is one
            // an owner can send later without seeing what it says today.
            setDraft(draftOf(listing))
            setFacets([...listing.facet_slugs].sort())
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
