/**
 * Render the first page of a PDF the reader has chosen, in their browser, before it is
 * uploaded - so a wrong file is caught by eye rather than after scoring.
 *
 * pdf.js is imported on first use, not at module load: it is about a megabyte with its
 * worker, and only the submit page ever needs it. This module is the one place that
 * touches it, which is also what lets component tests replace it (jsdom has no canvas).
 */

export type RenderedPage = {
  /** An object URL for a PNG of page 1. The caller revokes it. */
  url: string
  width: number
  height: number
  pageCount: number
}

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null

function loadPdfjs() {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    // Bundled beside the page by `new URL(..., import.meta.url)`, so parsing runs off
    // the main thread and no CDN is involved.
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    return lib
  })
  return pdfjs
}

/** Page 1 of `file`, rendered `width` CSS pixels wide at the device's pixel density. */
export async function renderFirstPage(file: Blob, width: number): Promise<RenderedPage> {
  const lib = await loadPdfjs()
  // Torn down through the loading task, which in pdf.js 6 owns the worker transport.
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const document = await task.promise
  try {
    const page = await document.getPage(1)
    const unscaled = page.getViewport({ scale: 1 })
    const scale = (width / unscaled.width) * (globalThis.devicePixelRatio || 1)
    const viewport = page.getViewport({ scale })

    const canvas = globalThis.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty render'))), 'image/png'),
    )
    return {
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      pageCount: document.numPages,
    }
  } finally {
    await task.destroy()
  }
}
