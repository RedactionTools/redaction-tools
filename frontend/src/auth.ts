import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

import { resolveAuthToken } from '@/lib/auth/resolve-token'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The container hostname differs from AUTH_URL when running under Compose.
  trustHost: true,
  // Match the backend's JWT_REFRESH_TOKEN_LIFETIME (14 days).
  session: { strategy: 'jwt', maxAge: 14 * 24 * 60 * 60 },
  pages: { signIn: '/auth/signin', error: '/auth/error' },

  providers: [
    Google({
      // Must be the same client id the backend has in GOOGLE_CLIENT_ID:
      // allauth validates the id_token's audience against its own config.
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
    }),
  ],

  callbacks: {
    // Cheap guard, no network. Without an id_token we cannot talk to allauth at
    // all, so fail the sign-in rather than create a tokenless session.
    signIn({ account }) {
      if (account?.provider !== 'google') return false
      return Boolean(account.id_token) || '/auth/error?error=MissingIdToken'
    },

    // All branching lives in resolveAuthToken so it stays unit-testable without
    // booting NextAuth. See src/lib/auth/resolve-token.ts.
    jwt({ token, account }) {
      return resolveAuthToken({ token, account })
    },

    session({ session, token }) {
      session.accessToken = token.accessToken
      session.accessTokenExpiresAt = token.accessTokenExpiresAt
      session.error = token.error
      return session
    },
  },
})
