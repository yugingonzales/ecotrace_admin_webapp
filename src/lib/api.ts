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
 * database. Types for every route payload live in `./types.ts` and were decoded
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
import type {
  AuthSession,
  EcoEvent,
  EventInput,
  EventProgressView,
  OverviewStats,
  Paginated,
  Plant,
  PlantInput,
  PlantStatus,
  PlantVerification,
  StudentPublic,
  VerificationInput,
} from './types'

// ── Configuration ───────────────────────────────────────────────────────────

/** Master switch. Flipping this off guarantees zero requests are dispatched. */
export const API_ENABLED = import.meta.env.VITE_ENABLE_API === 'true'

/** Origin-relative by default so the Vite dev proxy (or a reverse proxy) handles routing. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')

const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15_000)

/** Key used to persist the JWT. Kept separate from the legacy `ecotrace_session`. */
export const TOKEN_STORAGE_KEY = 'ecotrace_admin_token'

// ── Errors ──────────────────────────────────────────────────────────────────

/** Thrown for any non-2xx response, carrying the HTTP status for the caller. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Transport ───────────────────────────────────────────────────────────────

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — the in-memory session still works */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Send without the `Authorization` header (login, register). */
  anonymous?: boolean
  signal?: AbortSignal
}

/**
 * Perform a JSON request against the API.
 *
 * @throws {ApiError} on timeout, network failure, or any non-2xx status.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_ENABLED) {
    throw new ApiError(
      `API client is disabled (VITE_ENABLE_API !== "true"); refusing to call ${path}. ` +
        'Enable it in .env.local once the Node.js backend is running.',
      0,
    )
  }

  const { method = 'GET', body, anonymous = false, signal } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!anonymous) {
    const token = readToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? controller.signal,
    })
  } catch (cause) {
    const aborted = cause instanceof DOMException && cause.name === 'AbortError'
    throw new ApiError(
      aborted
        ? `Request to ${path} timed out after ${TIMEOUT_MS}ms.`
        : `Network request to ${path} failed — is the API running?`,
      0,
      cause,
    )
  } finally {
    clearTimeout(timer)
  }

  // 204 and other empty bodies must not be passed to .json()
  const text = await response.text()
  const payload: unknown = text ? safeParse(text) : null

  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } | string } | null)?.error != null
        ? String(
            (payload as { error: { message?: string } }).error?.message ??
              (payload as { error: string }).error,
          )
        : `Request to ${path} failed with status ${response.status}.`
    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}

function safeParse(text: string): unknown {
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

/** `POST /api/auth/login` → `ecotrace_students` (verifies `password_hash`). */
export function login(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  })
}

/** `GET /api/auth/me` */
export function me(): Promise<StudentPublic> {
  return request<StudentPublic>('/auth/me')
}

/** `GET /api/overview` → aggregates the Command Overview stat cards. */
export function getOverviewStats(): Promise<OverviewStats> {
  return request<OverviewStats>('/overview')
}

/**
 * `GET /api/plants` → `ecotrace_plants`.
 *
 * `bounds` is the four-parameter viewport form the server validates as a unit:
 * a partial box is rejected with 400 rather than silently ignored, because
 * ignoring it would return every row and look like a filter that does nothing.
 */
export function listPlants(
  params: {
    status?: PlantStatus | string
    zone?: string
    minLat?: number
    maxLat?: number
    minLng?: number
    maxLng?: number
    sort?: 'id' | 'code' | 'zone' | 'date' | 'status'
    dir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
  } = {},
): Promise<Paginated<Plant>> {
  return request<Paginated<Plant>>(`/plants${toQuery(params)}`)
}

/** `GET /api/plants/:id` */
export function getPlant(plantId: number): Promise<Plant> {
  return request<Plant>(`/plants/${plantId}`)
}

/** `POST /api/plants` */
export function createPlant(input: PlantInput): Promise<Plant> {
  return request<Plant>('/plants', { method: 'POST', body: input })
}

/** `PATCH /api/plants/:id` */
export function updatePlant(plantId: number, input: Partial<PlantInput>): Promise<Plant> {
  return request<Plant>(`/plants/${plantId}`, { method: 'PATCH', body: input })
}

/** `GET /api/events` → `ecotrace_events`. */
export function listEvents(
  params: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<EcoEvent>> {
  return request<Paginated<EcoEvent>>(`/events${toQuery(params)}`)
}

/** `POST /api/events` → `ecotrace_events` (CHECK `chk_date_range` applies). */
export function createEvent(input: EventInput): Promise<EcoEvent> {
  return request<EcoEvent>('/events', { method: 'POST', body: input })
}

/** `PATCH /api/events/:id` — used by the "extend deadline" control. */
export function updateEvent(eventId: number, input: Partial<EventInput>): Promise<EcoEvent> {
  return request<EcoEvent>(`/events/${eventId}`, { method: 'PATCH', body: input })
}

/** `GET /api/events/progress` → `vw_event_progress` (backs the Analytics charts). */
export function getEventProgress(): Promise<EventProgressView[]> {
  return request<EventProgressView[]>('/events/progress')
}

/** `GET /api/verifications` → `ecotrace_plant_verifications` (the Submissions table). */
export function listVerifications(
  params: { eventId?: number; healthStatus?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<PlantVerification>> {
  return request<Paginated<PlantVerification>>(`/verifications${toQuery(params)}`)
}

/** `POST /api/verifications` — backs the mobile field-verification submission. */
export function createVerification(input: VerificationInput): Promise<PlantVerification> {
  return request<PlantVerification>('/verifications', { method: 'POST', body: input })
}

/** `GET /api/health` — unauthenticated liveness probe. */
export function health(): Promise<{ status: string; db: string }> {
  return request<{ status: string; db: string }>('/health', { anonymous: true })
}

// NOTE: these two are intentionally absent. `AuditLogs.tsx` and the incident
// counters on the Overview have no backing table in `ecotrace_db` yet, so the
// corresponding routes cannot be specified honestly. They are called out in
// INTEGRATION_PROGRESS_LOG.md under "Schema gaps".
//   GET /api/audit-logs  -> needs `ecotrace_audit_logs`
//   GET /api/incidents   -> needs `ecotrace_incidents`

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
