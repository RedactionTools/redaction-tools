import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

// Raw HTML is left as text (react-markdown's default), and vendors write some
// of what passes through here: `linkRel` lets their copy carry nofollow.
export function Markdown({
  children,
  className,
  linkRel,
}: {
  children: string
  className?: string
  linkRel?: string
}) {
  const components: Components = {
    h1: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
    h2: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
    h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
    p: ({ children }) => <p className="text-pretty">{children}</p>,
    ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
    a: ({ href, title, children }) => (
      <a
        href={href}
        title={title}
        rel={linkRel}
        className="underline underline-offset-4 hover:no-underline"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="text-muted-foreground border-l-2 pl-4">{children}</blockquote>
    ),
    code: ({ children }) => (
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-sm">{children}</code>
    ),
  }

  return (
    <div className={cn('space-y-3', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
