/**
 * Signing in by email: trading the emailed code, or the link's token, for our pair.
 *
 * Unlike the Google exchange in `allauth.ts`, this endpoint is ours and in the
 * OpenAPI spec, so it goes through the generated client. The backend answers
 * any failure with a 400, which surfaces here as an `ApiError`.
 */
import { confirmEmailLogin as postConfirm } from '@/lib/api/generated/auth/auth'
import type { EmailLoginConfirmIn } from '@/lib/api/generated/model'
import { readJwtExpiry } from '@/lib/auth/jwt'
import type { TokenPair } from '@/lib/auth/tokens'

export type EmailLoginProof = { email: string; code: string } | { token: string }

export interface EmailSignIn {
  tokens: TokenPair
  /** For the session's name and email: there is no id_token to read them from. */
  user: { id: string; email: string; name: string }
}

export async function confirmEmailLogin(proof: EmailLoginProof): Promise<EmailSignIn> {
  const body: EmailLoginConfirmIn = proof
  const out = await postConfirm(body)
  return {
    tokens: {
      accessToken: out.access_token,
      refreshToken: out.refresh_token,
      accessTokenExpiresAt: readJwtExpiry(out.access_token) ?? Date.now() + out.expires_in * 1000,
    },
    user: { id: out.user.id, email: out.user.email, name: out.user.name },
  }
}
