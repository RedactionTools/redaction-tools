'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useStaffListScreenshots,
  useStaffReviewScreenshot,
  useStaffUploadScreenshot,
  useStaffUploadToolLogo,
} from '@/lib/api/generated/catalog-staff/catalog-staff'

import { EditorActions } from './editor-actions'
import { Field } from './plans-editor'
import { useAfterStaffWrite } from './use-staff-write'

// The formats `images.py` accepts - SVG is refused there - stated here too so
// the picker filters rather than the upload failing after it has been sent.
const ACCEPT = 'image/png,image/jpeg,image/webp'

/** Re-hosted and recorded as an edit, like the MCP's URL-fetched logos. */
export function LogoEditor({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const afterWrite = useAfterStaffWrite(slug)
  const upload = useStaffUploadToolLogo({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (file) upload.mutate({ slug, data: { image: file } })
      }}
    >
      <Field id={`${slug}-logo-file`} label="Logo file">
        <input
          id={`${slug}-logo-file`}
          type="file"
          accept={ACCEPT}
          className="text-muted-foreground w-full text-sm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <EditorActions
        error={upload.error}
        pending={upload.isPending}
        disabled={!file}
        onCancel={onDone}
        saveLabel="Upload logo"
      />
    </form>
  )
}

const TONES = { published: 'ok', pending: 'neutral', rejected: 'warn' } as const

/**
 * Every picture on the listing at any status, with a staff upload that
 * publishes on arrival. Pending rows are what a vendor sent in; the public
 * page cannot show them, so this is where they wait to be looked at.
 * Rejecting a published one takes it off the page and keeps the row.
 */
export function ScreenshotManager({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { data: shots } = useStaffListScreenshots(slug)
  const afterWrite = useAfterStaffWrite(slug)
  const review = useStaffReviewScreenshot({ mutation: { onSuccess: () => afterWrite() } })

  return (
    <div className="space-y-6">
      {shots === undefined ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <ul className="space-y-3">
          {shots.map((shot) => (
            <li key={shot.id} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                alt={shot.alt_text}
                width={shot.width}
                height={shot.height}
                className="border-border h-14 w-24 rounded border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="truncate">{shot.alt_text}</p>
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Badge tone={TONES[shot.status as keyof typeof TONES] ?? 'neutral'}>
                    {shot.status}
                  </Badge>
                  from {shot.source}
                </p>
              </div>
              {shot.status === 'published' ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Publish ${shot.alt_text}`}
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      screenshotId: shot.id,
                      data: { status: 'published', note: '' },
                    })
                  }
                >
                  Publish
                </Button>
              )}
              {shot.status === 'rejected' ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Reject ${shot.alt_text}`}
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({ screenshotId: shot.id, data: { status: 'rejected', note: '' } })
                  }
                >
                  Reject
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ScreenshotUpload slug={slug} />
      <Button size="sm" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}

function ScreenshotUpload({ slug }: { slug: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const afterWrite = useAfterStaffWrite(slug)
  const upload = useStaffUploadScreenshot({
    mutation: {
      onSuccess: () => {
        setFile(null)
        setAltText('')
        setCaption('')
        return afterWrite()
      },
    },
  })

  return (
    <form
      className="space-y-3"
      aria-label="Add a screenshot"
      onSubmit={(event) => {
        event.preventDefault()
        if (!file) return
        upload.mutate({
          slug,
          data: { image: file, alt_text: altText.trim(), caption: caption.trim() },
        })
      }}
    >
      <Field id={`${slug}-staff-shot-file`} label="Screenshot file">
        <input
          id={`${slug}-staff-shot-file`}
          type="file"
          accept={ACCEPT}
          className="text-muted-foreground w-full text-sm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <Field id={`${slug}-staff-shot-alt`} label="What it shows">
        <Input
          id={`${slug}-staff-shot-alt`}
          value={altText}
          maxLength={200}
          onChange={(event) => setAltText(event.target.value)}
        />
      </Field>
      <Field id={`${slug}-staff-shot-caption`} label="Caption (optional)">
        <Input
          id={`${slug}-staff-shot-caption`}
          value={caption}
          maxLength={300}
          onChange={(event) => setCaption(event.target.value)}
        />
      </Field>
      <EditorActions
        error={upload.error}
        pending={upload.isPending}
        disabled={!file || !altText.trim()}
        onCancel={() => {
          setFile(null)
          setAltText('')
          setCaption('')
        }}
        saveLabel="Upload and publish"
      />
    </form>
  )
}
