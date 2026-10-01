import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { notFound, redirect } from 'next/navigation'

import { auth } from '@/auth'
import { CommentSettingsCard, ModerationQueue } from '@/features/comments/moderation-queue'
import { getMe } from '@/lib/api/generated/auth/auth'
import {
  getStaffGetCommentSettingsQueryOptions,
  getStaffListCommentsQueryOptions,
} from '@/lib/api/generated/comments-staff/comments-staff'
import { getQueryClient } from '@/lib/query/client'

export const metadata = {
  title: 'Comment moderation',
  robots: { index: false, follow: false },
}

export default async function CommentModerationPage() {
  const session = await auth()
  if (!session || session.error) redirect('/auth/signin?callbackUrl=/staff/comments')

  // A 404 rather than a refusal for anyone else: the page is nobody's business
  // but staff's. The API refuses every call on it regardless.
  const me = await getMe().catch(() => null)
  if (!me?.is_staff) notFound()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(
      getStaffListCommentsQueryOptions({ status: 'pending', limit: 50, offset: 0 }),
    ),
    queryClient.prefetchQuery(getStaffGetCommentSettingsQueryOptions()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Comment moderation</h1>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ModerationQueue />
        <aside>
          <CommentSettingsCard />
        </aside>
      </div>
    </HydrationBoundary>
  )
}
