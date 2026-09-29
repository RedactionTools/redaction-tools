import type { Metadata } from 'next'

import { ClaimInvite } from '@/features/catalog/claim-invite'

export const metadata: Metadata = {
  title: 'Claim your listing',
  robots: { index: false, follow: false },
  // The token in the path is the whole credential: a click out of this page
  // must not hand it to the next site in a Referer header.
  referrer: 'no-referrer',
}

export default async function ClaimInvitePage({ params }: PageProps<'/claim/[token]'>) {
  const { token } = await params
  return (
    <div className="mx-auto max-w-2xl">
      <ClaimInvite token={token} />
    </div>
  )
}
