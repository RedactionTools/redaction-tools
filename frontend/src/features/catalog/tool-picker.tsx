'use client'

import { useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import type { ToolListItemOut } from '@/lib/api/generated/model'
import { cn } from '@/lib/utils'

import { ToolLogo } from './tool-logo'

/**
 * How many tools the picker shows before anything is typed.
 *
 * Enough that a reader browsing rather than hunting has something to click,
 * few enough that the list stays a preview rather than the old dropdown again.
 */
export const PREVIEW_COUNT = 6

/**
 * The tools matching a query, the ones whose name starts with it first.
 *
 * Name and vendor only: a tagline mentions redaction in nearly every listing,
 * so matching it would turn "redac" into every tool in the catalog.
 */
export function matchTools(tools: ToolListItemOut[], query: string): ToolListItemOut[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return tools.slice(0, PREVIEW_COUNT)

  const hits = tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(needle) || tool.vendor.name.toLowerCase().includes(needle),
  )
  const leading = (tool: ToolListItemOut) => (tool.name.toLowerCase().startsWith(needle) ? 0 : 1)
  // A stable sort, so within each group the catalog's own order survives.
  return hits.sort((a, b) => leading(a) - leading(b))
}

/**
 * A type-to-search adder for the calculator.
 *
 * A native select stopped scaling with the catalog: finding a tool meant
 * scrolling every one of them for a name the reader already knew. Focusing it
 * previews the first few, so a reader who is browsing rather than hunting is
 * not left facing an empty box.
 *
 * It is an adder rather than a picker: it never holds a value, because the
 * selection lives in the chips below it and in the URL.
 */
export function ToolPicker({
  id,
  tools,
  disabled = false,
  placeholder,
  onPick,
}: {
  id: string
  tools: ToolListItemOut[]
  disabled?: boolean
  placeholder: string
  onPick: (slug: string) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = matchTools(tools, query)
  const previewing = !query.trim()
  const expanded = open && !disabled
  const current = matches[Math.min(active, matches.length - 1)]

  const pick = (tool: ToolListItemOut) => {
    onPick(tool.slug)
    setQuery('')
    setActive(0)
    setOpen(false)
  }

  return (
    <div className="relative max-w-sm">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={expanded}
        aria-activedescendant={expanded && current ? `${listId}-${current.slug}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) return setOpen(true)
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive((index) => (index + step + matches.length) % Math.max(matches.length, 1))
          } else if (event.key === 'Enter' && expanded && current) {
            event.preventDefault()
            pick(current)
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {expanded ? (
        <div
          className="border-border bg-surface absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border shadow-lg"
          // Keeps focus in the input, so clicking an option does not blur it
          // and close the list before the click lands.
          onMouseDown={(event) => event.preventDefault()}
        >
          <ul
            id={listId}
            role="listbox"
            aria-label="Tools"
            className="max-h-80 overflow-y-auto py-1"
          >
            {matches.map((tool) => (
              <li
                key={tool.slug}
                id={`${listId}-${tool.slug}`}
                role="option"
                aria-selected={tool === current}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                  tool === current && 'bg-muted',
                )}
                onMouseEnter={() => setActive(matches.indexOf(tool))}
                onClick={() => pick(tool)}
              >
                <ToolLogo name={tool.name} logoUrl={tool.logo_url} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{tool.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {tool.vendor.name}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {!matches.length ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              No tools match “{query.trim()}”
            </p>
          ) : previewing && tools.length > matches.length ? (
            <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">
              Type to search all {tools.length} tools
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
