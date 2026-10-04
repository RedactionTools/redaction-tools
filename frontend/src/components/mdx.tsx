import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import Image, { type ImageProps } from 'next/image'
import type { ComponentProps } from 'react'

/**
 * fumadocs compiles `![alt](/images/...)` into a static import, an object. Its own
 * `img` hands that to the framework's Image, which falls back to a plain <img> - and
 * src="[object Object]" - wherever no fumadocs provider is mounted, as on the blog.
 * next/image takes the object everywhere.
 */
function MdxImage({ src, alt = '', width, height, title }: ComponentProps<'img'>) {
  return (
    <Image
      // Typed as an <img> attribute by MDX, but a static import at runtime; a remote
      // URL arrives as a string with the width and height fumadocs measured.
      src={src as ImageProps['src']}
      alt={alt}
      width={width as ImageProps['width']}
      height={height as ImageProps['height']}
      title={title}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
      className="rounded-lg"
    />
  )
}

export function getMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, img: MdxImage, ...components } satisfies MDXComponents
}
