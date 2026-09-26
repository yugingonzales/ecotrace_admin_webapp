/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Master switch for the API client in `src/lib/api.ts`. */
  readonly VITE_ENABLE_API?: string
  /** Base URL prefixed onto every API request path. */
  readonly VITE_API_BASE_URL?: string
  /** Abort a request after this many milliseconds. */
  readonly VITE_API_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
