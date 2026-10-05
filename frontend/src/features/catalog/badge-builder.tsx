'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetToolBadges } from '@/lib/api/generated/catalog/catalog'
import { BADGE_ALT, badgeEmbed, badgeImageUrl, type EmbedFormat } from '@/lib/badges/embed'
import { type BadgeKind, type BadgeTheme, contrastOnWhite, parseBadgeColor } from '@/lib/badges/svg'
import { clientEnv } from '@/lib/env'

const SITE = clientEnv.NEXT_PUBLIC_SITE_URL

/** The shield's own navy: where the picker starts, and what a badge wears without one. */
const DEFAULT_COLOR = '#192536'

/** WCAG's floor for large text, which the 16px bold claim is. */
const MIN_CONTRAST = 3

const KINDS: { kind: BadgeKind; label: string; locked: string }[] = [
  { kind: 'listed', label: 'Listed', locked: 'Appears once the listing is published.' },
  { kind: 'reviewed', label: 'Reviewed', locked: 'Not yet reviewed by our editors.' },
  { kind: 'benchmarked', label: 'Benchmarked', locked: 'No approved benchmark run yet.' },
]

const THEMES: { theme: BadgeTheme; label: string }[] = [
  { theme: 'light', label: 'Light' },
  { theme: 'dark', label: 'Dark' },
  { theme: 'auto', label: "Match the reader's system" },
]

const FORMATS: { format: EmbedFormat; label: string }[] = [
  { format: 'html', label: 'HTML' },
  { format: 'markdown', label: 'Markdown' },
]

/**
 * Lets an owner put a badge on their own site: pick one the listing has earned,
 * style it, see it and copy the snippet.
 *
 * The preview is the live route rather than a local render, so what the owner
 * sees here is exactly what their readers will - including a badge going grey.
 */
export function BadgeBuilder({ slug, name }: { slug: string; name: string }) {
  const { data } = useGetToolBadges(slug)
  const [kind, setKind] = useState<BadgeKind>('listed')
  const [theme, setTheme] = useState<BadgeTheme>('light')
  const [format, setFormat] = useState<EmbedFormat>('html')
  const [custom, setCustom] = useState(false)
  const [hex, setHex] = useState(DEFAULT_COLOR)

  if (!data) return <Skeleton className="h-24 w-full" />

  if (!data.listed) {
    return (
      <p className="text-muted-foreground text-sm">
        Badges for your site become available once your listing is published.
      </p>
    )
  }

  const color = custom ? parseBadgeColor(hex) : null
  const invalid = custom && color === null
  const options = { site: SITE, slug, kind, theme, color }
  const code = badgeEmbed(options, format)
  const image = badgeImageUrl(options)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Choice
          legend="Badge"
          name={`${slug}-badge-kind`}
          value={kind}
          onChange={setKind}
          options={KINDS.map((k) => ({
            value: k.kind,
            label: k.label,
            hint: data[k.kind] ? undefined : k.locked,
          }))}
        />
        <Choice
          legend="Theme"
          name={`${slug}-badge-theme`}
          value={theme}
          onChange={setTheme}
          options={THEMES.map((t) => ({ value: t.theme, label: t.label }))}
        >
          <ColorChoice
            id={`${slug}-badge-color`}
            custom={custom}
            onCustomChange={setCustom}
            hex={hex}
            onHexChange={setHex}
            invalid={invalid}
          />
        </Choice>
        <Choice
          legend="Format"
          name={`${slug}-badge-format`}
          value={format}
          onChange={setFormat}
          options={FORMATS.map((f) => ({ value: f.format, label: f.label }))}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2" aria-label={`Preview of the ${name} badge`}>
        {/* Both backgrounds, whatever the theme: the owner's site is one of them. */}
        <div className="flex h-24 items-center justify-center rounded-md border border-zinc-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG route, not an optimisable photo */}
          <img src={image} alt={BADGE_ALT[kind]} height={54} />
        </div>
        <div className="flex h-24 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src={image} alt={BADGE_ALT[kind]} height={54} />
        </div>
      </div>

      <div className="bg-muted flex items-start gap-2 rounded-md py-1.5 pr-1.5 pl-3">
        <code
          className="min-w-0 flex-1 py-1.5 font-mono text-xs break-all"
          data-testid="badge-snippet"
        >
          {code}
        </code>
        <CopyButton text={code} label="Copy badge code" disabled={invalid} />
      </div>
    </div>
  )
}

interface ColorChoiceProps {
  id: string
  custom: boolean
  onCustomChange: (custom: boolean) => void
  hex: string
  onHexChange: (hex: string) => void
  invalid: boolean
}

/** The claim half's colour: a brand colour beats our default on the owner's own site. */
function ColorChoice({ id, custom, onCustomChange, hex, onHexChange, invalid }: ColorChoiceProps) {
  const valid = parseBadgeColor(hex)
  return (
    <div className="space-y-1.5 pt-1">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={custom} onChange={(event) => onCustomChange(event.target.checked)} />
        Custom colour
      </label>
      {custom && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Pick a colour"
            value={valid ? `#${valid}` : DEFAULT_COLOR}
            onChange={(event) => onHexChange(event.target.value)}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <Input
            id={id}
            aria-label="Colour hex"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            value={hex}
            onChange={(event) => onHexChange(event.target.value)}
            className="h-8 font-mono"
            spellCheck={false}
          />
        </div>
      )}
      {invalid && (
        <p id={`${id}-error`} className="text-warn text-xs">
          Enter six hex digits, like {DEFAULT_COLOR}.
        </p>
      )}
      {custom && valid && contrastOnWhite(valid) < MIN_CONTRAST && (
        <p className="text-warn text-xs">
          This colour is hard to read on a light background. Pick a darker one, or use the dark
          theme.
        </p>
      )}
    </div>
  )
}

interface ChoiceProps<T extends string> {
  legend: string
  children?: React.ReactNode
  name: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; hint?: string }[]
}

/** A native radio group: no new dependency, and keyboard behaviour for free. */
function Choice<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  children,
}: ChoiceProps<T>) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.hint !== undefined}
            onChange={() => onChange(option.value)}
            className="mt-1"
          />
          <span>
            <span className={option.hint ? 'text-muted-foreground' : undefined}>
              {option.label}
            </span>
            {option.hint && (
              <span className="text-muted-foreground block text-xs">{option.hint}</span>
            )}
          </span>
        </label>
      ))}
      {children}
    </fieldset>
  )
}
