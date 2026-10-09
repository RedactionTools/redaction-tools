import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'

import { confirmEmailLogin, type EmailLoginProof } from '@/lib/auth/email-login'
import { resolveAuthToken } from '@/lib/auth/resolve-token'

const field = (value: unknown) => (typeof value === 'string' ? value : '')

/** The emailed code (with its address) or the link's token, whichever was sent. */
function emailLoginProof(credentials: Partial<Record<string, unknown>>): EmailLoginProof | null {
  const token = field(credentials.token)
  if (token) return { token }
  const email = field(credentials.email)
  const code = field(credentials.code)
  return email && code ? { email, code } : null
}

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
    // One email carries a code and a link; either signs in. The backend mints
    // the pair here, and resolveAuthToken keeps it - see src/lib/auth/email-login.ts.
    Credentials({
      id: 'email',
      credentials: { email: {}, code: {}, token: {} },
      async authorize(credentials) {
        const proof = emailLoginProof(credentials)
        if (!proof) return null
        try {
          const { tokens, user } = await confirmEmailLogin(proof)
          // next-auth copies name and email onto the session; resolveAuthToken keeps tokens.
          return { ...user, name: user.name || null, tokens }
        } catch {
          return null
        }
      },
    }),
  ],

  callbacks: {
    // Cheap guard, no network. An email sign-in got this far only by passing
    // `authorize`, which already checked the code. Without an id_token we cannot talk to allauth at
    // all, so fail the sign-in rather than create a tokenless session.
    signIn({ account }) {
      if (account?.provider === 'email') return true
      if (account?.provider !== 'google') return false
      return Boolean(account.id_token) || '/auth/error?error=MissingIdToken'
    },

    // All branching lives in resolveAuthToken so it stays unit-testable without
    // booting NextAuth. See src/lib/auth/resolve-token.ts.
    jwt({ token, account, user }) {
      return resolveAuthToken({ token, account, user })
    },

    session({ session, token }) {
      session.accessToken = token.accessToken
      session.accessTokenExpiresAt = token.accessTokenExpiresAt
      session.error = token.error
      return session
    },
  },
})
