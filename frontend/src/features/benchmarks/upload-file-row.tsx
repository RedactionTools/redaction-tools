'use client'

import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { CaseOut } from '@/lib/api/generated/model'
import { renderFirstPage, type RenderedPage } from '@/lib/benchmarks/pdf-preview'
import { cn } from '@/lib/utils'

import { previewAlt } from './case-preview'

/** Wide enough to read a planted value when the comparison is opened, small enough to
 * render dozens of files quickly. The row shows it scaled down as a thumbnail. */
const RENDER_WIDTH = 480

/** Big enough to recognise the page and see where redaction boxes landed, at a glance. */
const THUMB = 'w-32 shrink-0 sm:w-40'

type Preview = { status: 'loading' } | { status: 'failed' } | ({ status: 'ready' } & RenderedPage)

/** Page 1 of `file`, rendered in the browser; the object URL is released on unmount. */
function useFirstPage(file: File): Preview {
  const [preview, setPreview] = useState<Preview>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    let url: string | null = null
    renderFirstPage(file, RENDER_WIDTH).then(
      (page) => {
        url = page.url
        if (alive) setPreview({ status: 'ready', ...page })
        else URL.revokeObjectURL(page.url)
      },
      () => alive && setPreview({ status: 'failed' }),
    )
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])
  return preview
}

export type UploadState = 'ready' | 'uploading' | 'done' | 'failed'

const STATE_LABEL: Record<UploadState, string> = {
  ready: 'Ready',
  uploading: 'Uploading…',
  done: 'Uploaded',
  failed: 'Refused',
}

/**
 * One chosen file before (and while) it is uploaded: its first page, the case it goes
 * with, and anything visible now that the server would refuse later - a PDF that will
 * not open, or one with a different page count from its case.
 */
export function UploadFileRow({
  file,
  caseId,
  cases,
  state,
  error,
  onCaseChange,
  onRemove,
}: {
  file: File
  caseId: string
  cases: CaseOut[]
  state: UploadState
  error?: string
  onCaseChange: (caseId: string) => void
  onRemove: () => void
}) {
  const preview = useFirstPage(file)
  const matched = cases.find((c) => c.case_id === caseId)
  const pageMismatch =
    preview.status === 'ready' && matched && preview.pageCount !== matched.page_count

  return (
    <li className="flex items-start gap-4 py-3">
      <Thumbnail file={file} preview={preview} matched={matched} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="truncate font-mono text-xs">{file.name}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label={`Case for ${file.name}`}
            className="w-auto"
            value={caseId}
            disabled={state !== 'ready'}
            onChange={(e) => onCaseChange(e.target.value)}
          >
            <option value="">Which case?</option>
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_id}
              </option>
            ))}
          </Select>
          <span className="text-muted-foreground text-xs">{STATE_LABEL[state]}</span>
          {/* Only before it reaches the server, or after the server refused it: an
              uploaded file is stored against the submission, and a row that vanished
              here would not take it back. */}
          {state === 'ready' || state === 'failed' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove ${file.name}`}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
        {preview.status === 'failed' ? (
          <p className="text-warn text-xs">
            This file could not be read as a PDF. The site will refuse it.
          </p>
        ) : null}
        {pageMismatch ? (
          <p className="text-warn text-xs">
            This file has {preview.pageCount} pages; {matched.case_id} has {matched.page_count}. Is
            it the right file?
          </p>
        ) : null}
        {error ? (
          <p className="text-warn text-xs" role="alert">
            {error}
          </p>
        ) : null}
        {preview.status === 'ready' ? (
          <p className="text-muted-foreground text-xs">
            Select the page to compare it with the case.
          </p>
        ) : null}
      </div>
    </li>
  )
}

function Thumbnail({
  file,
  preview,
  matched,
}: {
  file: File
  preview: Preview
  matched: CaseOut | undefined
}) {
  if (preview.status === 'loading') return <Skeleton className={cn(THUMB, 'aspect-[1/1.414]')} />
  if (preview.status === 'failed') {
    return <div className={cn(THUMB, 'border-border bg-muted aspect-[1/1.414] rounded border')} />
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Compare ${file.name} with its case`}
        className={cn(THUMB, 'border-border cursor-zoom-in overflow-hidden rounded border')}
      >
        {/* A blob URL of a canvas render: nothing for next/image to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          width={preview.width}
          height={preview.height}
          alt={`First page of ${file.name}`}
          className="h-auto w-full"
        />
      </DialogTrigger>
      <DialogContent className="border-border fixed inset-4 z-50 flex flex-col gap-3 overflow-auto rounded-lg border p-4 sm:inset-8">
        <div className="flex items-start justify-between gap-4">
          <DialogTitle>
            {file.name}
            {matched ? ` beside ${matched.case_id}` : ''}
          </DialogTitle>
          <DialogClose className="text-muted-foreground hover:text-foreground text-sm">
            Close
          </DialogClose>
        </div>
        <p className="text-muted-foreground text-sm">
          The tool’s output should be the case with its sensitive values removed. If the pages do
          not match, the file is for a different case.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="space-y-1">
            <figcaption className="text-sm font-medium">Your file</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              width={preview.width}
              height={preview.height}
              alt={`Your file: ${file.name}`}
              className="border-border h-auto w-full rounded border"
            />
          </figure>
          {matched?.preview ? (
            <figure className="space-y-1">
              <figcaption className="text-sm font-medium">The case, as we sent it</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={matched.preview.url}
                srcSet={matched.preview.srcset}
                sizes="(min-width: 640px) 50vw, 100vw"
                width={matched.preview.width}
                height={matched.preview.height}
                alt={previewAlt(matched.case_id)}
                className="border-border h-auto w-full rounded border"
              />
            </figure>
          ) : (
            <p className="text-muted-foreground self-center text-sm">
              Choose a case to compare against.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
