import type { Metadata } from 'next'
import Link from 'next/link'

import { clientEnv } from '@/lib/env'
import { canonicalMetadata } from '@/lib/seo/canonical'
import { aboutPageJsonLd, breadcrumbJsonLd, combineJsonLd, operatorJsonLd } from '@/lib/seo/json-ld'
import {
  BENCHMARKS_REPO_URL,
  FIRST_PARTY_SITE_URL,
  GITHUB_REPO_URL,
  OPERATOR_NAME,
  OPERATOR_URL,
  REDDIT_URL,
  SITE_NAME,
} from '@/lib/seo/site'

const TITLE = 'About Redaction Tools'

const DESCRIPTION =
  'Redaction Tools is operated by StabRise, which also makes PDF Redaction, a tool listed in this catalog. Who runs the site, and how that interest is handled.'

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  ...canonicalMetadata('/about'),
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="underline underline-offset-4">
      {children}
    </a>
  )
}

export default function AboutPage() {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  return (
    <div className="max-w-2xl space-y-10">
      {/* StabRise is defined in full here and nowhere else: every other page
          reaches it through the parentOrganization pointer on our own node. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: combineJsonLd([
            aboutPageJsonLd(site, { name: TITLE, description: DESCRIPTION }),
            operatorJsonLd(site),
            breadcrumbJsonLd(site, [
              { name: 'Redaction tools', url: `${site}/` },
              { name: 'About', url: `${site}/about` },
            ]),
          ]),
        }}
      />

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{TITLE}</h1>
        <p className="text-muted-foreground text-pretty">
          {SITE_NAME} is a catalog of tools that redact documents, images, video and audio, compared
          by price, media and method. Every price carries its unit, its currency, its source and the
          date it was last checked, so any figure here can be traced back to the vendor&apos;s own
          page.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Who runs it</h2>
        <p className="text-pretty">
          {SITE_NAME} is operated by{' '}
          <ExternalLink href={OPERATOR_URL}>{OPERATOR_NAME}</ExternalLink>, a software company based
          in Marki, Poland, that builds AI-powered document processing software. You can reach us at{' '}
          <ExternalLink href="mailto:info@stabrise.com">info@stabrise.com</ExternalLink> or on{' '}
          <ExternalLink href={REDDIT_URL}>r/RedactionTools</ExternalLink>.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="disclosure">
        <h2 id="disclosure" className="text-xl font-semibold">
          Disclosure: we also make a tool in this catalog
        </h2>
        <p className="text-pretty">
          {OPERATOR_NAME} also builds and sells{' '}
          <ExternalLink href={FIRST_PARTY_SITE_URL}>PDF Redaction</ExternalLink>{' '}
          (pdf-redaction.com), and{' '}
          <Link href="/tool/pdf-redaction" className="underline underline-offset-4">
            it is listed here
          </Link>{' '}
          alongside its competitors. That gives us a commercial interest in one of the tools this
          site compares, and you should weigh what you read here with that in mind.
        </p>
        <p className="text-pretty">This is how we keep that interest from shaping the catalog:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Its page says plainly that it is our own product. It has to meet the same bar to be
            listed as every other tool, and it is never sorted to the top.
          </li>
          <li>
            Its prices are recorded the same way as everyone else&apos;s, with the source and the
            date they were checked.{' '}
            <Link href="/docs/methodology" className="underline underline-offset-4">
              How we verify prices
            </Link>{' '}
            applies to it unchanged.
          </li>
          <li>The price calculator starts with no tool selected, so it never defaults to ours.</li>
          <li>
            Benchmark results for it are submitted and reviewed through the same process as any
            other tool&apos;s.
          </li>
          <li>
            The catalog&apos;s first price figures were transcribed from comparison tables we kept
            on pdf-redaction.com. Each one shows its source, so you can check it against the
            vendor&apos;s own page.
          </li>
        </ul>
        <p className="text-pretty">
          You do not have to take any of this on trust. The catalog and the benchmark tool are both
          open source:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <ExternalLink href={GITHUB_REPO_URL}>RedactionTools/redaction-tools</ExternalLink> is
            the code behind this site, including how tools are listed, filtered, sorted and priced.
          </li>
          <li>
            <ExternalLink href={BENCHMARKS_REPO_URL}>
              RedactionTools/pdf-redaction-benchmarks
            </ExternalLink>{' '}
            is pdfredeval, the scorer behind every benchmark result, so you can see exactly how a
            result is scored and score your own runs the same way.
          </li>
        </ul>
        <p className="text-pretty">
          If a listing looks unfair to you, whether it is ours or a competitor&apos;s, tell us at{' '}
          <ExternalLink href="mailto:info@stabrise.com">info@stabrise.com</ExternalLink>. Vendors
          can also claim their listing and correct it.
        </p>
      </section>
    </div>
  )
}
