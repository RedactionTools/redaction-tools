import Script from 'next/script'

/**
 * `lazyOnload` defers both scripts to browser idle after the page's own load,
 * so gtag never competes with rendering, hydration or LCP. Client-side route
 * changes need no wiring: GA4's enhanced measurement records history changes
 * as page views on its own.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  )
}
