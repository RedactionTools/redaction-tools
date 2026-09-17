/**
 * The error type every generated hook rejects with.
 *
 * backend/openapi.json declares no 4xx responses, so Orval types `TError` as
 * `unknown`. src/types/react-query.d.ts registers this class as the default
 * error instead, which is what makes `query.error.status` typed at call sites.
 */
export class ApiError extends Error {
  readonly status: number
  readonly url: string
  readonly body: unknown

  constructor(message: string, status: number, url: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    this.body = body
  }

  static async fromResponse(response: Response, url: string): Promise<ApiError> {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // A non-JSON error body is not worth failing over.
    }
    return new ApiError(`${url} responded ${response.status}`, response.status, url, body)
  }
}
