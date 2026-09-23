import { SITE_NAME } from '@/lib/seo/site'

/**
 * The share card, drawn for satori rather than for a browser.
 *
 * Three constraints run through every style here. Satori supports a subset of
 * CSS - flexbox only, and any element with more than one child needs an
 * explicit `display: flex`. Colours are hard-coded hex rather than the
 * `oklch()` design tokens in `globals.css`, which satori and resvg handle
 * unreliably; a rasterised card has no dark mode and no theming, so the
 * duplication buys correctness rather than costing consistency. And no
 * `fontFamily` is named anywhere: satori resolves fonts only from the array it
 * is handed, and naming one we have not loaded renders tofu. Unnamed, it uses
 * the Geist that `next/og` bundles - which is also why no font file is read
 * from disk, the thing that would break under `output: 'standalone'`.
 */

const INK = '#1c1c1c'
const PAPER = '#fbfbfa'
const MUTED = '#6b6b6b'
const RULE = '#e4e4e2'

/** The motif the whole catalog is about: a bar over what used to be there. */
function RedactionBar({ width, height = 28 }: { width: number; height?: number }) {
  return <div style={{ width, height, backgroundColor: INK, borderRadius: 3 }} />
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <RedactionBar width={44} height={22} />
      <div style={{ fontSize: 26, color: INK, letterSpacing: 1.5, fontWeight: 600 }}>
        {SITE_NAME.toUpperCase()}
      </div>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: PAPER,
        padding: 64,
      }}
    >
      {children}
    </div>
  )
}

/** One tool: who makes it, what it is called, what it costs. */
export function ToolCard({
  name,
  vendor,
  price,
  verified,
}: {
  name: string
  vendor: string
  price: string
  verified: string | null
}) {
  return (
    <Frame>
      <Wordmark />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 30, color: MUTED }}>{vendor}</div>
        <div style={{ fontSize: 76, color: INK, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderTop: `2px solid ${RULE}`,
          paddingTop: 28,
        }}
      >
        <div style={{ fontSize: 44, color: INK, fontWeight: 600 }}>{price}</div>
        {/* One interpolated string, not `Price checked {verified}`: that is two
            children, and satori throws on any element with more than one
            unless it is told `display: flex`. */}
        {verified ? (
          <div style={{ fontSize: 24, color: MUTED }}>{`Price checked ${verified}`}</div>
        ) : null}
      </div>
    </Frame>
  )
}

/** The site, for everywhere that is not one tool's page. */
export function SiteCard({ tagline }: { tagline: string }) {
  return (
    <Frame>
      <Wordmark />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 64, color: INK, fontWeight: 700, lineHeight: 1.15 }}>
          Redaction tools compared by price, media and method
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RedactionBar width={180} height={20} />
          <RedactionBar width={90} height={20} />
        </div>
      </div>

      <div style={{ fontSize: 28, color: MUTED, borderTop: `2px solid ${RULE}`, paddingTop: 28 }}>
        {tagline}
      </div>
    </Frame>
  )
}

/**
 * One blog post: its title, and who wrote it when. The title is sized down for
 * long headlines, which satori will not shrink to fit on its own.
 */
export function ArticleCard({ title, byline }: { title: string; byline: string }) {
  return (
    <Frame>
      <Wordmark />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 26, color: MUTED, letterSpacing: 1.5 }}>BLOG</div>
        <div
          style={{
            fontSize: title.length > 60 ? 56 : 72,
            color: INK,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
      </div>

      <div style={{ fontSize: 28, color: MUTED, borderTop: `2px solid ${RULE}`, paddingTop: 28 }}>
        {byline}
      </div>
    </Frame>
  )
}
