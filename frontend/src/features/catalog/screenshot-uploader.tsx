'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { analytics } from '@/lib/analytics'
import { errorMessage } from '@/lib/api/error-message'
import {
  getListMyScreenshotsQueryKey,
  useListMyScreenshots,
  useUploadToolScreenshot,
  useWithdrawToolScreenshot,
} from '@/lib/api/generated/catalog/catalog'

const FALLBACK = 'That screenshot could not be uploaded. Please try again.'

const TONES = {
  published: 'ok',
  pending: 'neutral',
  rejected: 'warn',
} as const

const EXPLANATIONS: Record<string, string> = {
  published: 'On the listing.',
  pending: 'Stored and waiting for an editor.',
  rejected: 'Not published.',
}

/**
 * An owner's own screenshots, and the form that adds one.
 *
 * The one kind of content a vendor holds that we cannot produce ourselves - and
 * still a proposal, like every other thing they send. The statuses are shown
 * rather than summarised because "pending" is the state an owner would
 * otherwise read as "lost": the file uploaded, nothing appeared on the page,
 * and no part of the public site would explain the gap.
 */
export function ScreenshotUploader({ slug, name }: { slug: string; name: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const queryClient = useQueryClient()
  const { data: mine } = useListMyScreenshots(slug)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMyScreenshotsQueryKey(slug) })
  const upload = useUploadToolScreenshot({ mutation: { onSuccess: invalidate } })
  const withdraw = useWithdrawToolScreenshot({ mutation: { onSuccess: invalidate } })

  return (
    <div className="space-y-4">
      {mine && mine.length > 0 ? (
        <ul className="space-y-2" data-testid="my-screenshots">
          {mine.map((shot) => (
            <li key={shot.id} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                srcSet={shot.srcset}
                sizes="96px"
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                className="border-border h-14 w-24 rounded border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="truncate">{shot.alt}</p>
                <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={TONES[shot.status as keyof typeof TONES] ?? 'neutral'}>
                    {shot.status}
                  </Badge>
                  {EXPLANATIONS[shot.status]}
                </p>
                {/* A rejection with no reason reads as a picture that vanished. */}
                {shot.review_note ? <p className="text-warn text-xs">{shot.review_note}</p> : null}
              </div>
              {shot.status === 'published' ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate({ slug, screenshotId: shot.id })}
                >
                  Withdraw
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="space-y-3"
        aria-label={`Upload a screenshot of ${name}`}
        onSubmit={(event) => {
          event.preventDefault()
          if (!file) return
          analytics.capture('listing_screenshot_uploaded', { tool_slug: slug })
          upload.mutate(
            { slug, data: { image: file, alt_text: altText.trim(), caption: caption.trim() } },
            {
              onSuccess: () => {
                setFile(null)
                setAltText('')
                setCaption('')
              },
            },
          )
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`${slug}-screenshot-file`}>
            Screenshot file
          </label>
          <input
            id={`${slug}-screenshot-file`}
            type="file"
            // The formats the backend accepts, stated here too so the picker
            // filters rather than the upload failing after it has been sent.
            accept="image/png,image/jpeg,image/webp"
            className="text-muted-foreground w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-muted-foreground text-xs">
            PNG, JPEG or WebP. Send the largest capture you have - we render it at every size the
            site needs, and a small one cannot be enlarged.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`${slug}-screenshot-alt`}>
            What it shows
          </label>
          <Input
            id={`${slug}-screenshot-alt`}
            value={altText}
            maxLength={200}
            onChange={(event) => setAltText(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Read aloud to anyone who cannot see the picture, so describe the interface rather than
            the point you are making with it.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`${slug}-screenshot-caption`}>
            Caption (optional)
          </label>
          <Input
            id={`${slug}-screenshot-caption`}
            value={caption}
            maxLength={300}
            onChange={(event) => setCaption(event.target.value)}
          />
        </div>

        {upload.error ? (
          <p className="text-warn text-sm" role="alert">
            {errorMessage(upload.error, FALLBACK)}
          </p>
        ) : null}
        {upload.isSuccess ? (
          <p className="text-ok text-sm" role="status">
            Uploaded. An editor reviews it before it appears on the listing.
          </p>
        ) : null}

        <Button type="submit" disabled={!file || altText.trim().length === 0 || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload screenshot'}
        </Button>
      </form>
    </div>
  )
}
