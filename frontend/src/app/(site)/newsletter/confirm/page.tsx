import type { Metadata } from 'next'

import { NewsletterConfirm } from '@/features/newsletter/newsletter-link'

export const metadata: Metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
  // The token in the query is the whole credential: a click out of this page
  // must not hand it to the next site in a Referer header.
  referrer: 'no-referrer',
}

export default async function NewsletterConfirmPage({
  searchParams,
}: PageProps<'/newsletter/confirm'>) {
  const { token } = await searchParams
  return (
    <div className="mx-auto max-w-2xl">
      <NewsletterConfirm token={typeof token === 'string' ? token : ''} />
    </div>
  )
}
