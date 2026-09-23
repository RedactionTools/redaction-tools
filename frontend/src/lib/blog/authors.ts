/**
 * The people a post can be credited to.
 *
 * Plain TypeScript rather than an MDX collection: the frontmatter schema, the
 * JSON-LD and the tests all need it, and none of them may import the fumadocs
 * macro in `./source.ts`.
 *
 * Every link is optional and only what the author has published - it becomes
 * the `sameAs` of their Person node, which a search engine uses to join them
 * up with the profiles it already knows.
 */
export type Author = {
  name: string
  role?: string
  /** Under `/images/blog/authors/`. */
  avatar?: string
  bio?: string
  links?: { github?: string; linkedin?: string; x?: string; website?: string }
}

export const AUTHORS = {
  'mykola-melnyk': {
    name: 'Mykola Melnyk',
    role: 'Maintainer, Redaction Tools',
  },
} as const satisfies Record<string, Author>

export type AuthorId = keyof typeof AUTHORS

export const DEFAULT_AUTHOR: AuthorId = 'mykola-melnyk'

export function isAuthorId(id: string): id is AuthorId {
  return Object.hasOwn(AUTHORS, id)
}

export function getAuthor(id: string): Author | undefined {
  return isAuthorId(id) ? AUTHORS[id] : undefined
}
