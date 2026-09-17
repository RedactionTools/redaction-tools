import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

// Next infers a workspace root by walking up for lockfiles and would find the
// repo root (which also holds the backend); pin it so standalone tracing stays
// inside frontend/.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
}

export default nextConfig
