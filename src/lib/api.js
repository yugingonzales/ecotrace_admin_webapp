/**
 * Typed REST client for the EcoTrace Node.js API.
 *
 * ## Status: INERT BY DEFAULT
 * This module issues **no network traffic** unless `VITE_ENABLE_API=true` is set
 * in the environment (see `.env.example`). Every export is async and resolves,
 * but while the flag is off the helpers short-circuit before `fetch` is called,
 * so the portal keeps rendering its existing mock data untouched.
 *
 * ## Target backend
 * A Node.js (v24) + Express 5 service talking to the MariaDB `ecotrace_db`
 * database. Types for every route payload live in `./types.js` and were decoded
 * from the real InnoDB table definitions.
 *
 * ## Why this file exists
 * The audit that produced INTEGRATION_PROGRESS_LOG.md found the admin portal had
 * zero network code. This client establishes the contract first: once the API is
 * running, migrating a module is a matter of swapping its mock array for the
 * matching call here — no other change to that component is required.
 *
 * ## Enabling
 *   1. Start the API on port 3000 (see the log for the route table).
 *   2. `cp .env.example .env.local` and set `VITE_ENABLE_API=true`.
 *   3. In dev, requests to `/api` are proxied to `http://localhost:3000` by
 *      `vite.config.js`, so no CORS configuration is needed.
 */
// Types are referenced through `import('./types.js')` in the JSDoc below rather
// than an `import type` statement, which is TypeScript-only. A single typedef
// aliases the module so each annotation stays short and greppable.

/** @typedef {import('./types.js').AuthSession} AuthSession */
/** @typedef {import('./types.js').EcoEvent} EcoEvent */
/** @typedef {import('./types.js').EventInput} EventInput */
/** @typedef {import('./types.js').EventProgressView} EventProgressView */
/** @typedef {import('./types.js').OverviewStats} OverviewStats */
/** @typedef {import('./types.js').Paginated<any>} Paginated */
/** @typedef {import('./types.js').Tree} Tree */
/** @typedef {import('./types.js').TreeInput} TreeInput */
/** @typedef {import('./types.js').TreeStatus} TreeStatus */
/** @typedef {import('./types.js').PlantVerification} PlantVerification */
/** @typedef {import('./types.js').StudentPublic} StudentPublic */
/** @typedef {import('./types.js').VerificationInput} VerificationInput */

// ── Configuration ───────────────────────────────────────────────────────────

// Vite statically replaces the literal text `import.meta.env.VITE_*` at build
// time, so these need no declaration file. src/vite-env.d.ts — the last
// TypeScript file in the repo — is gone; the type of each key is spelled out
// inline instead.
//
// Do NOT hoist `import.meta.env` into a local `const env` and then read
// `env.VITE_*`: Vite only rewrites the fully-qualified literal, so that form
// silently embeds the entire env object in the bundle (+2.5 kB, measured).

/** Master switch. Flipping this off guarantees zero requests are dispatched. */
export const API_ENABLED =
  /** @type {string | undefined} */ (import.meta.env.VITE_ENABLE_API) === 'true'

/** Origin-relative by default so the Vite dev proxy (or a reverse proxy) handles routing. */
export const API_BASE_URL = (
  /** @type {string | undefined} */ (import.meta.env.VITE_API_BASE_URL) ?? '/api'
).replace(/\/+$/, '')

const TIMEOUT_MS = Number(
  /** @type {string | undefined} */ (import.meta.env.VITE_API_TIMEOUT_MS) ?? 15_000,
)

/** Key used to persist the JWT. Kept separate from the legacy `ecotrace_session`. */
export const TOKEN_STORAGE_KEY = 'ecotrace_admin_token'

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * Thrown for any non-2xx response, carrying the HTTP status for the caller.
 *
 * TypeScript parameter properties (`constructor(readonly status: number, ...)`)
 * have no JavaScript equivalent, so `status` and `body` are assigned explicitly
 * below. `status` 0 is the sentinel for "never reached the server" — timeout,
 * network failure, or a refused call because `API_ENABLED` is off.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {unknown} [body]
   */
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// ── Transport ───────────────────────────────────────────────────────────────

/** @returns {string | null} */
function readToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * @param {string | null} token
 * @returns {void}
 */
export function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — the in-memory session still works */
  }
}

/**
 * @typedef {object} RequestOptions
 * @property {'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'} [method]
 * @property {unknown} [body]
 * @property {boolean} [anonymous] Send without the `Authorization` header (login, register).
 * @property {AbortSignal} [signal]
 */

/**
 * Perform a JSON request against the API.
 *
 * @template T
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<T>}
 * @throws {ApiError} on timeout, network failure, or any non-2xx status.
 */
export async function request(path, options = {}) {
  if (!API_ENABLED) {
    throw new ApiError(
      `API client is disabled (VITE_ENABLE_API !== "true"); refusing to call ${path}. ` +
        'Enable it in .env.local once the Node.js backend is running.',
      0
    )
  }

  const { method = 'GET', body, anonymous = false, signal } = options

  // The timeout is a real AbortController rather than a boolean flag, because a
  // fetch that has already received its headers can still stall while the body
  // streams in. `timedOut` is what lets the two abort causes be told apart in
  // the message: a caller that passed its own `signal` and cancelled mid-flight
  // must not be told the request "timed out", or the debugger chases a timeout
  // that never happened.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)

  // `AbortSignal.any` composes both signals so neither can disable the other.
  // The previous `signal ?? controller.signal` meant that passing a caller
  // signal discarded the timeout entirely: the timer fired and aborted a
  // controller that was never handed to fetch, so the request could hang
  // forever. The manual fallback exists because `AbortSignal.any` is still
  // missing in some older Safari builds; it forwards the caller's abort onto
  // our controller so the same single signal reaches fetch either way.
  let linked = controller.signal
  if (signal) {
    if (typeof AbortSignal.any === 'function') {
      linked = AbortSignal.any([signal, controller.signal])
    } else {
      const onAbort = () => controller.abort()
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!anonymous) {
    const token = readToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  /** @type {Response} */
  let response
  /** @type {unknown} */
  let payload = null
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: linked,
    })
    // 204 and other empty bodies must not be passed to .json(). This read lives
    // inside the try so a body that dies mid-stream becomes an ApiError like
    // every other transport failure, instead of a bare TypeError escaping a
    // function whose contract promises only ApiError.
    const text = await response.text()
    payload = text ? safeParse(text) : null
  } catch (cause) {
    // `cause.name` is checked rather than `instanceof DOMException`: an abort
    // is not reliably a DOMException across runtimes, and a `name` check is
    // what the DOM spec actually guarantees.
    const aborted = cause instanceof Error && cause.name === 'AbortError'
    throw new ApiError(
      aborted
        ? timedOut
          ? `Request to ${path} timed out after ${TIMEOUT_MS}ms.`
          : `Request to ${path} was cancelled by the caller.`
        : `Network request to ${path} failed — is the API running?`,
      0,
      cause
    )
  } finally {
    // Deferred until after the body is consumed, so the timeout covers the
    // whole exchange rather than stopping the moment headers land.
    clearTimeout(timer)
  }

  if (!response.ok) {
    const err = /** @type {{ error?: { message?: string } | string } | null} */ (payload)?.error
    const message =
      err != null
        ? String(
            /** @type {{ message?: string }} */ (err).message ??
              /** @type {string} */ (err)
          )
        : `Request to ${path} failed with status ${response.status}.`
    throw new ApiError(message, response.status, payload)
  }

  return /** @type {T} */ (payload)
}

/** @param {string} text @returns {unknown} */
function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}


// ── Endpoints ───────────────────────────────────────────────────────────────
// Each helper maps 1:1 onto a route the Node.js service must implement. None of
// these are called by the app yet; they are the drop-in surface for migrating
// each module off its mock data.

/**
 * @typedef {object} PlantQuery
 * @property {PlantStatus | string} [status]
 * @property {string} [zone]
 * @property {number} [minLat]
 * @property {number} [maxLat]
 * @property {number} [minLng]
 * @property {number} [maxLng]
 * @property {'id' | 'code' | 'zone' | 'date' | 'status'} [sort]
 * @property {'asc' | 'desc'} [dir]
 * @property {number} [page]
 * @property {number} [pageSize]
 */

/** @typedef {{ status?: string, page?: number, pageSize?: number }} EventQuery */
/** @typedef {{ eventId?: number, healthStatus?: string, page?: number, pageSize?: number }} VerificationQuery */

/**
 * `POST /api/auth/login` → `ecotrace_students` (verifies `password_hash`).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<AuthSession>}
 */
export function login(email, password) {
  return /** @type {Promise<AuthSession>} */ (
    request('/auth/login', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    })
  )
}

/**
 * `GET /api/auth/me`
 * @returns {Promise<StudentPublic>}
 */
export function me() {
  return /** @type {Promise<StudentPublic>} */ (request('/auth/me'))
}

/**
 * `GET /api/overview` → aggregates the Command Overview stat cards.
 * @returns {Promise<OverviewStats>}
 */
export function getOverviewStats() {
  return /** @type {Promise<OverviewStats>} */ (request('/overview'))
}

/**
 * `GET /api/plants` → `ecotrace_plants`.
 *
 * `bounds` is the four-parameter viewport form the server validates as a unit:
 * a partial box is rejected with 400 rather than silently ignored, because
 * ignoring it would return every row and look like a filter that does nothing.
 *
 * @param {PlantQuery} [params]
 * @returns {Promise<import('./types.js').Paginated<Tree>>}
 */
export function listPlants(params = {}) {
  return /** @type {Promise<import('./types.js').Paginated<Tree>>} */ (
    request(`/plants${toQuery(params)}`)
  )
}

/**
 * `GET /api/plants/:id`
 * @param {number} treeId
 * @returns {Promise<Tree>}
 */
export function getPlant(treeId) {
  return /** @type {Promise<Tree>} */ (request(`/plants/${treeId}`))
}

/**
 * `POST /api/plants`
 * @param {TreeInput} input
 * @returns {Promise<Tree>}
 */
export function createPlant(input) {
  return /** @type {Promise<Tree>} */ (
    request('/plants', { method: 'POST', body: input })
  )
}

/**
 * `PATCH /api/plants/:id`
 * @param {number} treeId
 * @param {Partial<TreeInput>} input
 * @returns {Promise<Tree>}
 */
export function updatePlant(treeId, input) {
  return /** @type {Promise<Tree>} */ (
    request(`/plants/${treeId}`, { method: 'PATCH', body: input })
  )
}

/**
 * `GET /api/events` → `ecotrace_events`.
 * @param {EventQuery} [params]
 * @returns {Promise<import('./types.js').Paginated<EcoEvent>>}
 */
export function listEvents(params = {}) {
  return /** @type {Promise<import('./types.js').Paginated<EcoEvent>>} */ (
    request(`/events${toQuery(params)}`)
  )
}

/**
 * `POST /api/events` → `ecotrace_events` (CHECK `chk_date_range` applies).
 * @param {EventInput} input
 * @returns {Promise<EcoEvent>}
 */
export function createEvent(input) {
  return /** @type {Promise<EcoEvent>} */ (
    request('/events', { method: 'POST', body: input })
  )
}

/**
 * `PATCH /api/events/:id` — used by the "extend deadline" control.
 * @param {number} eventId
 * @param {Partial<EventInput>} input
 * @returns {Promise<EcoEvent>}
 */
export function updateEvent(eventId, input) {
  return /** @type {Promise<EcoEvent>} */ (
    request(`/events/${eventId}`, { method: 'PATCH', body: input })
  )
}

/**
 * `GET /api/events/progress` → `vw_event_progress` (backs the Analytics charts).
 * @returns {Promise<EventProgressView[]>}
 */
export function getEventProgress() {
  return /** @type {Promise<EventProgressView[]>} */ (request('/events/progress'))
}

/**
 * `GET /api/verifications` → `ecotrace_plant_verifications` (the Submissions table).
 * @param {VerificationQuery} [params]
 * @returns {Promise<import('./types.js').Paginated<PlantVerification>>}
 */
export function listVerifications(params = {}) {
  return /** @type {Promise<import('./types.js').Paginated<PlantVerification>>} */ (
    request(`/verifications${toQuery(params)}`)
  )
}

/**
 * `POST /api/verifications` — backs the mobile field-verification submission.
 * @param {VerificationInput} input
 * @returns {Promise<PlantVerification>}
 */
export function createVerification(input) {
  return /** @type {Promise<PlantVerification>} */ (
    request('/verifications', { method: 'POST', body: input })
  )
}

/**
 * `GET /api/health` — unauthenticated liveness probe.
 * @returns {Promise<{ status: string, db: string }>}
 */
export function health() {
  return /** @type {Promise<{ status: string, db: string }>} */ (
    request('/health', { anonymous: true })
  )
}

// NOTE: these two are intentionally absent. `AuditLogs.jsx` and the incident
// counters on the Overview have no backing table in `ecotrace_db` yet, so the
// corresponding routes cannot be specified honestly. They are called out in
// INTEGRATION_PROGRESS_LOG.md under "Schema gaps".
//   GET /api/audit-logs  -> needs `ecotrace_audit_logs`
//   GET /api/incidents   -> needs `ecotrace_incidents`

/** @param {Record<string, string | number | undefined>} params @returns {string} */
function toQuery(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
