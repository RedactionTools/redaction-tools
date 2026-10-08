'use client'

import '@uiw/react-md-editor/markdown-editor.css'

import { useTheme } from 'next-themes'
import dynamic from 'next/dynamic'

import { Markdown } from '@/components/markdown'

// The editor touches `document` as it loads, so it never renders on the server.
// The no-highlight build: code fences in a draft do not need a syntax highlighter.
const MDEditor = dynamic(() => import('@uiw/react-md-editor/nohighlight'), {
  ssr: false,
  loading: () => <div className="border-border bg-surface h-[480px] rounded-md border" />,
})

/**
 * A markdown body with a toolbar and a live preview. The preview is our own
 * `<Markdown>`, so it shows what a reader would see and, like it, leaves raw
 * HTML as text.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const { resolvedTheme } = useTheme()

  return (
    <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        height={480}
        textareaProps={{ id }}
        components={{ preview: (source) => <Markdown>{source}</Markdown> }}
      />
    </div>
  )
}
