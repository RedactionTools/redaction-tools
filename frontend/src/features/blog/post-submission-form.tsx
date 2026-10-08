'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { analytics } from '@/lib/analytics'
import { errorMessage } from '@/lib/api/error-message'
import { useCreatePostSubmission } from '@/lib/api/generated/blog/blog'

import { MarkdownEditor } from './markdown-editor'

const LINK_SLOTS = 3
const FALLBACK = 'That could not be submitted. Please try again.'

function splitTags(raw: string) {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function PostSubmissionForm({ defaultAuthor = '' }: { defaultAuthor?: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState(defaultAuthor)
  const [authorRole, setAuthorRole] = useState('')
  const [authorBio, setAuthorBio] = useState('')
  const [links, setLinks] = useState<string[]>(Array(LINK_SLOTS).fill(''))
  const { mutate, isPending, isSuccess, error } = useCreatePostSubmission()

  if (isSuccess) {
    return (
      <p className="text-ok" role="status">
        Thank you. Your post is with an editor, who reads every submission and will get back to you.
        Follow its status on{' '}
        <Link className="underline" href="/activity">
          your activity page
        </Link>
        .
      </p>
    )
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        analytics.capture('post_submission_sent')
        mutate({
          data: {
            title,
            description,
            tags: splitTags(tags),
            body_md: body,
            author_name: authorName,
            author_role: authorRole,
            author_bio: authorBio,
            author_links: links.map((link) => link.trim()).filter(Boolean),
          },
        })
      }}
    >
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">The post</legend>
        <Field id="post-title" label="Title" value={title} onChange={setTitle} required />
        <Field
          id="post-description"
          label="Summary"
          value={description}
          onChange={setDescription}
          required
        />
        <Field id="post-tags" label="Tags" value={tags} onChange={setTags} />
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="post-body">
            Post
          </label>
          <MarkdownEditor id="post-body" value={body} onChange={setBody} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">About you</legend>
        <Field id="author-name" label="Name" value={authorName} onChange={setAuthorName} required />
        <Field id="author-role" label="Role" value={authorRole} onChange={setAuthorRole} />
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="author-bio">
            Short bio
          </label>
          <Textarea
            id="author-bio"
            rows={3}
            value={authorBio}
            onChange={(event) => setAuthorBio(event.target.value)}
          />
        </div>
        {links.map((link, index) => (
          <Field
            key={index}
            id={`author-link-${index + 1}`}
            label={`Link ${index + 1}`}
            type="url"
            value={link}
            onChange={(value) => setLinks(links.map((old, i) => (i === index ? value : old)))}
          />
        ))}
      </fieldset>

      {error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(error, FALLBACK)}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit for review'}
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
