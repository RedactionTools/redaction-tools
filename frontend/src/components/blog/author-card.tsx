import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAuthor } from '@/lib/blog/authors'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const LINK_LABELS = { github: 'GitHub', linkedin: 'LinkedIn', x: 'X', website: 'Website' } as const

export function AuthorCard({ authorId }: { authorId: string }) {
  const author = getAuthor(authorId)
  if (!author) return null

  const links = Object.entries(author.links ?? {}).filter(([, href]) => href) as [
    keyof typeof LINK_LABELS,
    string,
  ][]

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        {author.avatar ? <AvatarImage src={author.avatar} alt="" /> : null}
        <AvatarFallback>{initials(author.name)}</AvatarFallback>
      </Avatar>
      <div className="text-sm">
        <p className="font-medium">{author.name}</p>
        {author.role ? <p className="text-muted-foreground">{author.role}</p> : null}
        {links.length ? (
          <p className="text-muted-foreground flex gap-3">
            {links.map(([kind, href]) => (
              <a
                key={kind}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {LINK_LABELS[kind]}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  )
}
