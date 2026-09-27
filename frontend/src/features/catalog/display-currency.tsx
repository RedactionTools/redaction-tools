'use client'

import { useState } from 'react'

import { Select } from '@/components/ui/select'
import { useListExchangeRates } from '@/lib/api/generated/catalog/catalog'
import { basePrice, type Conversion, type KeyedPlan } from '@/lib/catalog/document-cost'

/** Offered whether or not a plan on screen is published in them. */
const COMMON = ['USD', 'EUR', 'GBP']

/** The currencies the rows publish in, most common first, USD winning a tie. */
function publishedCurrencies(rows: KeyedPlan[]): string[] {
  const counts = new Map<string, number>()
  for (const { plan } of rows) {
    const currency = basePrice(plan)?.currency
    if (currency) counts.set(currency, (counts.get(currency) ?? 0) + 1)
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || Number(b === 'USD') - Number(a === 'USD'))
    .map(([currency]) => currency)
}

/**
 * The currency a cost table shows its totals in, and the rates that get there.
 *
 * Defaults to what most of the rows are published in, so a single-currency
 * table converts nothing until the reader asks it to. `conversion` is null
 * until rates arrive - or if the refresh has never run - and the table then
 * behaves as it always did: each row in its own currency, ranked only when
 * they share one.
 */
export function useDisplayCurrency(rows: KeyedPlan[]) {
  const { data } = useListExchangeRates()
  const [chosen, setChosen] = useState<string | null>(null)

  const rates = data?.as_of ? data.rates : null
  const published = publishedCurrencies(rows)
  const options = [...new Set([...published, ...COMMON])].filter(
    (currency) => rates && currency in rates,
  )
  const currency = chosen ?? published[0] ?? 'USD'
  const conversion: Conversion | null = rates && currency in rates ? { currency, rates } : null

  return {
    conversion,
    currency,
    options,
    setCurrency: setChosen,
    asOf: data?.as_of ?? null,
    /** Whether any row is shown in a currency it was not published in. */
    converts: conversion !== null && published.some((published) => published !== currency),
  }
}

export function CurrencySelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: string[]
  onChange: (currency: string) => void
}) {
  // One option is no choice at all.
  if (options.length < 2) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-muted-foreground text-sm" htmlFor={id}>
        Show prices in
      </label>
      <Select
        id={id}
        className="w-auto"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Said under a table that converted anything, so a ≈ figure is never mistaken for a quote. */
export function ConversionNote({ asOf }: { asOf: string }) {
  const date = new Date(`${asOf}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <p className="text-muted-foreground text-sm text-pretty" data-testid="conversion-note">
      Figures marked ≈ are converted at the ECB reference rates of {date}. The published price is
      the vendor&apos;s own, in the currency they quote it in; your bill will follow their rate, not
      this one.
    </p>
  )
}
