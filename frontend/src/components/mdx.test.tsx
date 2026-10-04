import { screen } from '@testing-library/react'
import type { ComponentType, ImgHTMLAttributes } from 'react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { getMDXComponents } from './mdx'

describe('getMDXComponents', () => {
  it('renders a Markdown image that fumadocs compiled into a static import', () => {
    // `![alt](/images/...)` reaches the component as an object, not a string. The
    // blog has no fumadocs framework provider, and without one an `img` that hands
    // the object to a plain <img> renders src="[object Object]".
    const Img = getMDXComponents().img as ComponentType<
      Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: unknown }
    >
    renderWithProviders(
      <Img src={{ src: '/images/blog/post/figure.png', width: 900, height: 600 }} alt="A figure" />,
    )

    expect(screen.getByAltText('A figure').getAttribute('src')).toContain(
      encodeURIComponent('/images/blog/post/figure.png'),
    )
  })
})
