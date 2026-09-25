'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

const REPO = 'https://github.com/RedactionTools/pdf-redaction-benchmarks'

/**
 * Clone and `uv run` rather than `uv tool install`: pdfredeval is not on PyPI, and the
 * clone is also what brings its pinned lockfile - the scorer version a result names.
 */
const STEPS = [
  {
    title: 'Get pdfredeval',
    command: `git clone ${REPO} && cd pdf-redaction-benchmarks`,
  },
  {
    title: 'Sign in - your browser opens here; approve the code',
    command: 'uv run pdfredeval login',
  },
  {
    title: 'Score your runs, then publish them',
    command: 'uv run pdfredeval score <run_dir> && uv run pdfredeval publish <run_dir>',
  },
] as const

/**
 * The other way in: for people who ran the tool through pdfredeval already. Publishing
 * from the CLI sends their own scores, which we rescore - so it sits beside the upload
 * form, not instead of it.
 */
export function CliPublishCard() {
  return (
    <Card className="max-w-3xl space-y-4">
      <div className="space-y-1">
        <CardTitle>Publish from the command line</CardTitle>
        <CardDescription>
          Ran the cases with pdfredeval? Sign in once from your terminal and publish scored runs
          directly. We rescore every PDF and badge the result verified or disputed.
        </CardDescription>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.command} className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
              {step.title}
            </p>
            <Command text={step.command} />
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-sm">
        Over SSH, add <code>--no-browser</code> and open the printed link anywhere. For CI, use an
        API key from your{' '}
        <Link href="/account" className="text-foreground hover:underline">
          account page
        </Link>
        .{' '}
        <Link
          href="/docs/benchmarks/publishing-from-the-cli"
          className="text-foreground hover:underline"
        >
          Full guide
        </Link>
      </p>
    </Card>
  )
}

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="bg-muted flex items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">
        {text}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Copy: ${text}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            // No clipboard (insecure context, denied permission): the text is selectable.
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
