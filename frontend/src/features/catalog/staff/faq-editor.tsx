'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useStaffGetTool,
  useStaffUpdateTool,
} from '@/lib/api/generated/catalog-staff/catalog-staff'
import type { FaqItemOut, StaffToolOut } from '@/lib/api/generated/model'

import { EditorActions } from './editor-actions'
import { useAfterStaffWrite } from './use-staff-write'

/** The listing's questions, saved as the whole list - that is what the field holds. */
export function FaqEditor({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { data: record } = useStaffGetTool(slug)
  if (!record) return <Skeleton className="h-20 w-full" />
  return <Form record={record} onDone={onDone} />
}

function Form({ record, onDone }: { record: StaffToolOut; onDone: () => void }) {
  const [entries, setEntries] = useState<FaqItemOut[]>(record.faq)
  const afterWrite = useAfterStaffWrite(record.slug)
  const save = useStaffUpdateTool({
    mutation: { onSuccess: () => afterWrite().then(onDone) },
  })
  // A half-written pair is dropped rather than saved: a question with no
  // answer is a promise the page does not keep.
  const complete = entries
    .map((entry) => ({ question: entry.question.trim(), answer: entry.answer.trim() }))
    .filter((entry) => entry.question && entry.answer)

  const update = (index: number, change: Partial<FaqItemOut>) =>
    setEntries((current) =>
      current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)),
    )

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ slug: record.slug, data: { changes: { faq: complete } } })
      }}
    >
      {entries.map((entry, index) => (
        <fieldset key={index} className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`faq-q-${index}`}>
            Question {index + 1}
          </label>
          <Input
            id={`faq-q-${index}`}
            value={entry.question}
            onChange={(event) => update(index, { question: event.target.value })}
          />
          <label className="text-sm font-medium" htmlFor={`faq-a-${index}`}>
            Answer {index + 1}
          </label>
          <Textarea
            id={`faq-a-${index}`}
            rows={3}
            value={entry.answer}
            onChange={(event) => update(index, { answer: event.target.value })}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEntries((current) => current.filter((_, at) => at !== index))}
          >
            Remove question {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setEntries((current) => [...current, { question: '', answer: '' }])}
      >
        Add a question
      </Button>
      <EditorActions
        error={save.error}
        pending={save.isPending}
        disabled={JSON.stringify(complete) === JSON.stringify(record.faq)}
        onCancel={onDone}
      />
    </form>
  )
}
