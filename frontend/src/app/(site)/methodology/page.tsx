import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How we source prices and decide what gets listed',
  description:
    'Where every price in this catalog comes from, how we mark its provenance, what a listing has to clear to be published, and how to correct us.',
  alternates: { canonical: '/methodology' },
}

export default function MethodologyPage() {
  return (
    <article className="prose-none max-w-2xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          How we verify prices and decide what gets listed
        </h1>
        <p className="text-muted-foreground text-pretty">
          A comparison is only worth reading if you can check it. This page says where every number
          comes from, what we will not do, and how to tell us we are wrong.
        </p>
      </header>

      <Section title="Where a price comes from">
        <p>Every published figure carries one of three marks, and they mean different things.</p>
        <dl className="space-y-3">
          <Entry term="⟳ Read automatically">
            Taken from the vendor&apos;s own public pricing page on the date shown. No login,
            paywall or bot protection is ever bypassed to obtain one.
          </Entry>
          <Entry term="✎ Entered by our editors">
            Typed in by a person, from the source noted on the listing. This is how tools whose
            pricing page cannot be read automatically still get a published price, instead of being
            quietly excluded.
          </Entry>
          <Entry term="🏷 Supplied by the vendor">
            Submitted by a verified representative and reviewed by us. It is labelled{' '}
            <strong>not independently verified</strong>, because it is not.
          </Entry>
        </dl>
        <p>
          Where these disagree, a person decides. A staff or vendor figure is pinned, which means an
          automated reading can never silently replace it.
        </p>
      </Section>

      <Section title="What we will not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Present a trial as a free tier. &ldquo;Free for 14 days&rdquo; and &ldquo;free
            forever&rdquo; are different products, and we record them separately.
          </li>
          <li>
            Quote an annual-prepay rate as if it were a monthly one, or a per-seat price as a flat
            one. Every figure carries its unit.
          </li>
          <li>
            Invent a limit a vendor has not published. An unpublished cap is recorded as
            unpublished.
          </li>
          <li>
            Publish a price we could not confirm. A stale number is marked stale, never refreshed by
            assumption.
          </li>
        </ul>
      </Section>

      <Section title="What a listing has to clear">
        <p>
          A tool appears in the catalog only once it has a vendor, a working link, a logo, at least
          one medium, deployment and method recorded, a pricing position, and several hundred words
          of our own writing. Copy supplied by a vendor never counts toward that last one, and is
          shown in a separate, labelled block.
        </p>
      </Section>

      <Section title="Conflicts of interest">
        <p>
          If a tool in this catalog is our own, its listing says so. It is never sorted to the top,
          its price is recorded the same way as everyone else&apos;s, and no vendor can pay for
          placement or for a better position.
        </p>
      </Section>

      <Section title="Corrections">
        <p>
          If a figure here is wrong, tell us and we will fix it. Vendors can{' '}
          <Link className="underline" href="/submit">
            claim their listing
          </Link>{' '}
          and propose a correction; every proposal is reviewed by a person before anything changes,
          and the published result says the vendor supplied it.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Entry({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  )
}
