import type { AuthTokenError } from '@/lib/auth/resolve-token'

// `next-auth/jwt` is a bare `export * from "@auth/core/jwt"`, so augmenting it
// would declare a separate interface rather than merging with the real one.
// The JWT augmentation therefore targets @auth/core/jwt directly.

declare module 'next-auth' {
  interface Session {
    /** Our backend's access token, not Google's. Absent once `error` is set. */
    accessToken?: string
    accessTokenExpiresAt?: number
    error?: AuthTokenError
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpiresAt?: number
    error?: AuthTokenError
  }
}
