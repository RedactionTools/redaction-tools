'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { errorMessage } from '@/lib/api/error-message'
import {
  useCreateBenchmarkSubmission,
  useFinalizeBenchmarkSubmission,
  useGetBenchmarkSuite,
  useUploadBenchmarkOutput,
} from '@/lib/api/generated/benchmarks/benchmarks'
import { useListTools } from '@/lib/api/generated/catalog/catalog'
import type { ListToolsParams, MySubmissionOut } from '@/lib/api/generated/model'
import { caseIdFromFilename } from '@/lib/benchmarks/format'

import { CaseDownloads, SUBMIT_SUITE_PARAMS } from './case-downloads'
import { UploadFileRow, type UploadState } from './upload-file-row'

export { SUBMIT_SUITE_PARAMS }

/** Every listable tool in one page: the picker's options. The page prefetches this key. */
export const SUBMIT_TOOL_PARAMS: ListToolsParams = { page_size: 100 }

type Pending = {
  /** Stable across removals, so a row keeps its rendered preview when one above goes. */
  id: number
  file: File
  caseId: string
  state: UploadState
  error?: string
}

const FALLBACK = 'That did not go through. Try again in a moment.'

/**
 * Submit a tool's outputs for us to score: pick the tool, drop the PDFs it produced,
 * send. We score them in the background and an editor reviews the result before it is
 * published - the page says so at every step, so nobody expects an instant leaderboard.
 */
export function SubmitResults({ suite }: { suite: string }) {
  const { data: suiteData } = useGetBenchmarkSuite(suite, SUBMIT_SUITE_PARAMS)
  const { data: tools } = useListTools(SUBMIT_TOOL_PARAMS)
  const create = useCreateBenchmarkSubmission()
  const upload = useUploadBenchmarkOutput()
  const finalize = useFinalizeBenchmarkSubmission()

  const [tool, setTool] = useState('')
  const [surface, setSurface] = useState('')
  const [tier, setTier] = useState('')
  const [toolVersion, setToolVersion] = useState('')
  const [submission, setSubmission] = useState<MySubmissionOut | null>(null)
  const [files, setFiles] = useState<Pending[]>([])
  const [sent, setSent] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)

  const caseIds = suiteData?.cases.map((c) => c.case_id) ?? []

  if (sent) {
    return (
      <Card className="space-y-2" role="status">
        <CardTitle>Sent. We are scoring it now.</CardTitle>
        <CardDescription>
          Scoring takes a minute or two per case. After that an editor reviews the result, and it
          joins the leaderboard once approved.
        </CardDescription>
        <Link href="/benchmarks/submissions" className="text-sm font-medium hover:underline">
          Follow it on your submissions page
        </Link>
      </Card>
    )
  }

  if (!submission) {
    return (
      <div className="space-y-8">
        <CaseDownloads suite={suite} />
        <form
          className="max-w-xl space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            const opened = await create
              .mutateAsync({
                suite,
                data: {
                  tool,
                  surface: surface as 'web',
                  origin: 'upload',
                  tier,
                  tool_version: toolVersion,
                },
              })
              .catch(() => null)
            if (opened) setSubmission(opened)
          }}
        >
          <Field id="submit-tool" label="Tool">
            <Select
              id="submit-tool"
              required
              value={tool}
              onChange={(e) => setTool(e.target.value)}
            >
              <option value="">Choose the tool you ran…</option>
              {tools?.items.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="submit-surface" label="How you ran it">
            <Select
              id="submit-surface"
              required
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
            >
              <option value="">Choose…</option>
              <option value="web">Web app</option>
              <option value="desktop">Desktop app</option>
              <option value="api">API</option>
            </Select>
          </Field>
          <Field id="submit-tier" label="Plan or tier (optional)">
            <Input id="submit-tier" value={tier} onChange={(e) => setTier(e.target.value)} />
          </Field>
          <Field id="submit-version" label="Tool version (optional)">
            <Input
              id="submit-version"
              value={toolVersion}
              onChange={(e) => setToolVersion(e.target.value)}
            />
          </Field>
          {create.isError ? (
            <p className="text-warn text-sm" role="alert">
              {errorMessage(create.error, FALLBACK)}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Start
          </Button>
        </form>
      </div>
    )
  }

  const ready = files.filter((f) => f.state === 'ready' && f.caseId)
  const uploaded = files.filter((f) => f.state === 'done')

  // By id, not position: a file can be removed while another is still uploading.
  function update(id: number, change: Partial<Pending>) {
    setFiles((current) => current.map((f) => (f.id === id ? { ...f, ...change } : f)))
  }

  async function uploadAll() {
    // One at a time, in order: each is a PDF of up to 20 MB, and a failure should name
    // its own file rather than be lost in a burst of parallel requests.
    for (const item of files) {
      if (item.state !== 'ready' || !item.caseId) continue
      update(item.id, { state: 'uploading' })
      try {
        await upload.mutateAsync({
          submissionId: submission!.id,
          data: { case_id: item.caseId, pdf: item.file },
        })
        update(item.id, { state: 'done' })
      } catch (error) {
        update(item.id, { state: 'failed', error: errorMessage(error, FALLBACK) })
      }
    }
  }

  return (
    <div className="space-y-8">
      <CaseDownloads suite={suite} />
      <div className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <label htmlFor="submit-files" className="block font-medium">
            Redacted PDFs
          </label>
          <p className="text-muted-foreground text-sm">
            One file per case, exactly as the tool returned it. Files named after their case are
            matched automatically.
          </p>
          {/* The native control is kept - it is what the label names and what a
            screen reader announces - but hidden behind a button that looks like the
            rest of the form and opens the same picker. */}
          <input
            ref={fileInput}
            id="submit-files"
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []).map<Pending>((file) => ({
                id: nextId.current++,
                file,
                caseId: caseIdFromFilename(file.name, caseIds) ?? '',
                state: 'ready',
              }))
              setFiles((current) => [...current, ...picked])
              event.target.value = ''
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
            Choose files
          </Button>
        </div>

        {files.length ? (
          <ul className="divide-border divide-y text-sm">
            {files.map((item) => (
              <UploadFileRow
                key={item.id}
                file={item.file}
                caseId={item.caseId}
                cases={suiteData?.cases ?? []}
                state={item.state}
                error={item.error}
                onCaseChange={(caseId) => update(item.id, { caseId })}
                onRemove={() => setFiles((current) => current.filter((f) => f.id !== item.id))}
              />
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={!ready.length || upload.isPending} onClick={uploadAll}>
            Upload {ready.length} {ready.length === 1 ? 'file' : 'files'}
          </Button>
          {uploaded.length ? (
            <Button
              type="button"
              variant="outline"
              disabled={finalize.isPending}
              onClick={async () => {
                const done = await finalize
                  .mutateAsync({ submissionId: submission.id })
                  .catch(() => null)
                if (done) setSent(true)
              }}
            >
              Send for scoring ({uploaded.length} of {caseIds.length} cases)
            </Button>
          ) : null}
        </div>
        {finalize.isError ? (
          <p className="text-warn text-sm" role="alert">
            {errorMessage(finalize.error, FALLBACK)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
