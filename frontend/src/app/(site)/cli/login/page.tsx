import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { CliLoginApproval } from '@/features/account/cli-login-approval'
import { getGetCliLoginQueryOptions } from '@/lib/api/generated/auth/auth'
import { getQueryClient } from '@/lib/query/client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Sign in pdfredeval',
  robots: { index: false, follow: false },
}

/** Where `pdfredeval login` opens the browser: sign in if needed, then approve. */
export default async function CliLoginPage({ searchParams }: PageProps<'/cli/login'>) {
  const raw = (await searchParams).code
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''

  const session = await auth()
  if (!session || session.error) {
    const back = code ? `/cli/login?code=${encodeURIComponent(code)}` : '/cli/login'
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

  const queryClient = getQueryClient()
  if (code) await queryClient.prefetchQuery(getGetCliLoginQueryOptions(code))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in pdfredeval</h1>
      <CliLoginApproval code={code} />
    </HydrationBoundary>
  )
}
