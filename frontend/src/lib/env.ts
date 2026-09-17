import { z } from 'zod'

/**
 * Next only inlines *literal* `process.env.NEXT_PUBLIC_X` member expressions,
 * so `schema.parse(process.env)` would yield `{}` in the browser. Each public
 * variable has to be written out by hand for the bundler to replace it.
 *
 * The dev default mirrors the backend's settings, which also default for local
 * work and demand real values in production.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:8007'),
})

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})
