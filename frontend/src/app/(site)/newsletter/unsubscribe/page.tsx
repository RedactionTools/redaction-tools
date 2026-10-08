import type { Metadata } from 'next'

import { NewsletterUnsubscribe } from '@/features/newsletter/newsletter-link'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function NewsletterUnsubscribePage({
  searchParams,
}: PageProps<'/newsletter/unsubscribe'>) {
  const { token } = await searchParams
  return (
    <div className="mx-auto max-w-2xl">
      <NewsletterUnsubscribe token={typeof token === 'string' ? token : ''} />
    </div>
  )
}
