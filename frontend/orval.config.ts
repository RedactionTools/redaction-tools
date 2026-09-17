import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: {
      // The committed schema, so the frontend build never needs a running
      // backend. `make schema` regenerates it and then this client from it.
      target: '../backend/openapi.json',
    },
    output: {
      mode: 'tags-split',
      client: 'react-query',
      httpClient: 'fetch',
      target: 'src/lib/api/generated/endpoints.ts',
      schemas: 'src/lib/api/generated/model',
      clean: true,

      // `baseUrl` is deliberately NOT set. Orval bakes it into the generated
      // source - including inside getXQueryKey() - which would put the origin
      // in every query key and make these committed files environment-specific.
      // The mutator prepends the origin at request time instead.

      override: {
        mutator: {
          path: './src/lib/api/fetcher.ts',
          name: 'customFetch',
        },
        fetch: {
          // Defaults to true, which makes every hook return
          // { data, status, headers } and forces `query.data.data.email`.
          includeHttpResponseReturnType: false,
        },
        query: {
          // `useQuery` and `useMutation` are deliberately unset. They are not
          // verb filters - each one applies to EVERY operation, so setting
          // either makes POSTs into queries (firing a write on render) or GETs
          // into mutations. Left alone, orval splits by HTTP verb, which is what
          // we want.
          signal: true,
          shouldExportKeys: true,
        },
      },
    },
  },
})
