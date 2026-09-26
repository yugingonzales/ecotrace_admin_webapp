/**
 * Shared client-side portal store.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The MariaDB API is read-only by design (see `server/`), so the admin portal
 * has nowhere to persist an Approve, a Decline or a new Event. Rather than leave
 * those buttons dead, every mutation lands here in `localStorage` and is labelled
 * in the UI as not yet synced to the database.
 *
 * ── The one rule that keeps the migration cheap ───────────────────────────────
 * Components NEVER call a setter. They call an action from this module, and each
 * action fans out to all three consumers in one place:
 *   1. the domain state (submissions / events / logs / notifications)
 *   2. an audit-log row
 *   3. a notification + a toast
 * Those three are currently independent and drift apart (the old Approve button
 * updated a local array, the audit log was a frozen fixture, and the only
 * notification fired from a hard-coded `setTimeout`). When the server gains write
 * endpoints, the bodies of the `act*` functions below are the only thing that
 * changes — a one-file change, as promised.
 *
 * ── Honesty constraints, deliberately preserved ────────────────────────────────
 * - Approving a submission does NOT recolour the map pin. Pins come from
 *   `usePlants` -> read-only MariaDB. Faking it would make the map lie about
 *   the server. An approval is visible on the sidebar badge, the Overview stats,
 *   the per-event pending counts and the audit log.
 * - The store is per-browser, not per-user. Two admins on two machines will not
 *   see each other's approvals. That is the honest ceiling of a read-only
 *   backend, not an oversight.
 * - `document.title` and the sidebar badge are derived from this store, so they
 *   cannot disagree with the data on screen.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { Boundary } from './site'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubType = 'verification' | 'incident'
export type SubStatus = 'pending' | 'approved' | 'declined' | 'resubmit'
export type NotifType = 'info' | 'warning' | 'error' | 'success'
export type EventStatusKey = 'active' | 'completed' | 'draft'

export interface Submission {
  id: string
  staffName: string
  staffId: string
  staffType: string
  treeTag: string
  species: string
  type: SubType
  status: SubStatus
  event: string
  /** Display string, e.g. 'Apr 28, 2026 09:14'. */
  date: string
  lat: string
  lng: string
  photo: string
  incidentType?: string
  notes?: string
  /** Set once a decline reason has been recorded. */
  declineReason?: string
}

export interface PortalEvent {
  id: string
  name: string
  year: string
  /** Display strings, e.g. 'Apr 15, 2026'. Derived from ISO on create/extend. */
  start: string
  end: string
  /** ISO (`YYYY-MM-DD`) — the form of `start`/`end` used for date arithmetic. */
  startIso: string
  endIso: string
  quota: number
  staff: number
  target: number
  verified: number
  pending: number
  incidents: number
  zone: string
  status: EventStatusKey
  description: string
  guidelines: string
  metrics: string[]
  boundary: Boundary
}

export interface AuditLogEntry {
  id: string
  /** `YYYY-MM-DD HH:mm:ss`, matching the MariaDB DATETIME rendering. */
  time: string
  admin: string
  adminId: string
  action: string
  detail: string
  count: number | null
  module: string
  /** True when this row came from a bundled fixture rather than a live action. */
  seeded: boolean
}

/**
 * Where a notification takes you when it is clicked.
 *
 * A discriminated union rather than a bag of optional fields, so an impossible
 * target — a `status` filter on a map target, say — is a compile error instead of
 * a link that silently does nothing. The last arm is derived from `Module`, so a
 * module added later is automatically targetable and cannot be forgotten here.
 *
 * `{ module: 'map' }` and `{ module: 'events' }` deliberately carry no focus
 * fields: no pane consumes a tree tag or an event id yet, and promising one here
 * would be a link that lands on the right page without doing what it says.
 */
export type NotificationTarget =
  | { module: 'submissions'; status?: SubStatus; type?: SubType; treeTag?: string; event?: string }
  | { module: 'events' }
  | { module: 'map' }
  | { module: Exclude<Module, 'submissions' | 'events' | 'map'> }

/** Target given to rows written before notifications were clickable. */
export const LEGACY_NOTIFICATION_TARGET: NotificationTarget = { module: 'overview' }

/** Work waiting on the admin, derived live — see `attention` on the context. */
export interface AttentionItem {
  /** Stable identity for React keys; also the item's dedupe key. */
  key: string
  msg: string
  type: NotifType
  target: NotificationTarget
}

export interface AppNotification {
  id: number
  msg: string
  type: NotifType
  time: number
  read: boolean
  /**
   * Optional in the type only because rows written by an older build lack it.
   * Every new row gets one (`pushNotification` requires it) and `hydrate`
   * backfills the rest, so in practice no rendered row is without a target.
   */
  target?: NotificationTarget
}

export interface ToastMessage {
  id: number
  msg: string
  type: 'success' | 'error'
}

export interface Actor {
  name: string
  email: string
}

/** What `CreateEventForm` hands to `createEvent`. */
export interface EventDraft {
  title: string
  description: string
  plantFrom: string
  plantTo: string
  quota: string
  start: string
  end: string
  zone: string
  boundary: Boundary
  guidelines: string
  metrics: string[]
}

export interface StoreSnapshot {
  submissions: Submission[]
  events: PortalEvent[]
  logs: AuditLogEntry[]
  notifications: AppNotification[]
  /** Ephemeral — deliberately NOT persisted. */
  toasts: ToastMessage[]
  actor: Actor | null
  /** How many extra historical pages `loadOlderLogs` has pulled in. */
  olderPages: number
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Moved here from the modules so the store owns hydration. A module can no longer
// fall back to its own array and silently disagree with what is persisted.

/** Coordinates are UEP Catarman, Northern Samar (12.50xx N / 124.66xx E) and are
 *  derived from the matching treeTag entries in `lib/trees.ts` so that every
 *  submission resolves to the same point the map layer renders. */
const SEED_SUBMISSIONS: Submission[] = [
  { id: 'SUB-4421', staffName: 'Juan Santos', staffId: 'STF-001', staffType: 'Volunteer', treeTag: 'TRE-0892', species: 'Narra (Pterocarpus indicus)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 28, 2026 09:14', lat: '12.5101', lng: '124.6679', photo: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=200&fit=crop&auto=format', notes: 'Tree is healthy, new growth visible.' },
  { id: 'SUB-4420', staffName: 'Maria Reyes', staffId: 'STF-002', staffType: 'Intern', treeTag: 'TRE-0567', species: 'Molave (Vitex parviflora)', type: 'incident', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 28, 2026 08:58', lat: '12.5098', lng: '124.6681', photo: 'https://images.unsplash.com/photo-1503785640985-f62e3aeee448?w=300&h=200&fit=crop&auto=format', incidentType: 'Dead / Uprooted Tree', notes: 'Tree has been uprooted, possibly by recent storm.' },
  { id: 'SUB-4419', staffName: 'Carlo Diaz', staffId: 'STF-003', staffType: 'Staff', treeTag: 'TRE-1204', species: 'Ipil (Intsia bijuga)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 16:31', lat: '12.5092', lng: '124.6677', photo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4418', staffName: 'Ana Lim', staffId: 'STF-004', staffType: 'Volunteer', treeTag: 'TRE-0341', species: 'Mahogany (Swietenia macrophylla)', type: 'verification', status: 'approved', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 14:05', lat: '12.5100', lng: '124.6671', photo: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4417', staffName: 'Ben Cruz', staffId: 'STF-005', staffType: 'Intern', treeTag: 'TRE-0783', species: 'Banaba (Lagerstroemia speciosa)', type: 'incident', status: 'declined', event: 'Earth Month Campaign', date: 'Apr 27, 2026 11:22', lat: '12.5135', lng: '124.6616', photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop&auto=format', incidentType: 'Location Mismatch', declineReason: 'Out-of-Bounds GPS' },
  { id: 'SUB-4416', staffName: 'Sofia Torres', staffId: 'STF-006', staffType: 'Staff', treeTag: 'TRE-1108', species: 'Kamagong (Diospyros blancoi)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 10:44', lat: '12.5094', lng: '124.6671', photo: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4415', staffName: 'Rico Mendoza', staffId: 'STF-007', staffType: 'Volunteer', treeTag: 'TRE-0223', species: 'Narra (Pterocarpus indicus)', type: 'verification', status: 'pending', event: 'Campus Reforestation Q2', date: 'Apr 26, 2026 15:18', lat: '12.5105', lng: '124.6676', photo: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4414', staffName: 'Lena Bautista', staffId: 'STF-008', staffType: 'Intern', treeTag: 'TRE-0950', species: 'Molave (Vitex parviflora)', type: 'incident', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 26, 2026 09:33', lat: '12.5128', lng: '124.6617', photo: 'https://images.unsplash.com/photo-1503785640985-f62e3aeee448?w=300&h=200&fit=crop&auto=format', incidentType: 'Pest Infestation' },
]

const SEED_EVENTS: PortalEvent[] = [
  { id: 'E001', name: 'Arbor Day Drive 2026', year: '2025–2026', start: 'Apr 15, 2026', end: 'May 15, 2026', startIso: '2026-04-15', endIso: '2026-05-15', quota: 50, staff: 45, target: 2250, verified: 1680, pending: 38, incidents: 7, zone: 'Zone A – Main Campus', status: 'active', description: 'Campus-wide planting drive.', guidelines: '', metrics: [], boundary: [] },
  { id: 'E002', name: 'Earth Month Campaign', year: '2025–2026', start: 'Apr 1, 2026', end: 'Apr 30, 2026', startIso: '2026-04-01', endIso: '2026-04-30', quota: 50, staff: 20, target: 1000, verified: 420, pending: 6, incidents: 3, zone: 'Zone B – Annex Field', status: 'active', description: 'Earth Month reforestation.', guidelines: '', metrics: [], boundary: [] },
  { id: 'E003', name: 'Campus Reforestation Q2', year: '2025–2026', start: 'May 1, 2026', end: 'Jun 30, 2026', startIso: '2026-05-01', endIso: '2026-06-30', quota: 50, staff: 15, target: 750, verified: 95, pending: 3, incidents: 2, zone: 'Zone C – Hillside Reserve', status: 'active', description: 'Hillside reserve reforestation.', guidelines: '', metrics: [], boundary: [] },
  { id: 'E004', name: 'Greening Initiative S1', year: '2024–2025', start: 'Sep 1, 2025', end: 'Oct 31, 2025', startIso: '2025-09-01', endIso: '2025-10-31', quota: 30, staff: 35, target: 1050, verified: 1020, pending: 0, incidents: 12, zone: 'Zone A – Main Campus', status: 'completed', description: 'First-half greening programme.', guidelines: '', metrics: [], boundary: [] },
]


const SEED_LOGS: AuditLogEntry[] = [
  { id: 'LOG-1044', time: '2026-04-28 10:42:31', admin: 'Admin Jane', adminId: 'ADM-001', action: 'BATCH_APPROVE', detail: 'Approved 45 submissions via batch process', count: 45, module: 'Submissions', seeded: true },
  { id: 'LOG-1043', time: '2026-04-28 10:15:09', admin: 'Admin Rex', adminId: 'ADM-002', action: 'BATCH_DECLINE', detail: 'Declined 3 submissions — Reason: Inaccurate Photo', count: 3, module: 'Submissions', seeded: true },
  { id: 'LOG-1042', time: '2026-04-28 09:51:44', admin: 'Admin Jane', adminId: 'ADM-001', action: 'EVENT_CREATE', detail: 'Created event: Arbor Day Drive 2026', count: null, module: 'Events', seeded: true },
  { id: 'LOG-1041', time: '2026-04-28 09:30:18', admin: 'Admin Carl', adminId: 'ADM-003', action: 'INCIDENT_FLAG', detail: 'Flagged high-priority incident: Destroyed planting area (Zone B, TRE-0567)', count: null, module: 'Submissions', seeded: true },
  { id: 'LOG-1040', time: '2026-04-28 09:14:55', admin: 'System', adminId: 'SYS', action: 'ALERT_SENT', detail: 'High-priority incident report received from J. Santos (SUB-4421)', count: null, module: 'System', seeded: true },
  { id: 'LOG-1039', time: '2026-04-28 08:55:12', admin: 'Admin Jane', adminId: 'ADM-001', action: 'EVENT_EXTEND', detail: 'Extended event end date by 7 days: Earth Month 2026 → May 7, 2026', count: null, module: 'Events', seeded: true },
  { id: 'LOG-1038', time: '2026-04-27 16:30:00', admin: 'Admin Rex', adminId: 'ADM-002', action: 'EXPORT', detail: 'Exported verification log (CSV) for Earth Month 2026 — 940 records', count: 940, module: 'Reports', seeded: true },
  { id: 'LOG-1037', time: '2026-04-27 14:05:33', admin: 'Admin Carl', adminId: 'ADM-003', action: 'SINGLE_APPROVE', detail: 'Approved submission SUB-4418 (Ana Lim, TRE-0341)', count: 1, module: 'Submissions', seeded: true },
  { id: 'LOG-1036', time: '2026-04-27 11:22:17', admin: 'Admin Rex', adminId: 'ADM-002', action: 'SINGLE_DECLINE', detail: 'Declined submission SUB-4417 — Reason: Location Mismatch', count: 1, module: 'Submissions', seeded: true },
  { id: 'LOG-1035', time: '2026-04-27 09:00:00', admin: 'Admin Jane', adminId: 'ADM-001', action: 'QUOTA_REASSIGN', detail: 'Bulk quota reassignment — Earth Month Campaign: 5 → 3 trees/staff', count: null, module: 'Events', seeded: true },
  { id: 'LOG-1034', time: '2026-04-26 17:45:00', admin: 'Admin Jane', adminId: 'ADM-001', action: 'STAFF_EXEMPT', detail: 'Removed staff STF-004 (Ana Lim) from Campus Reforestation Q2 — Medical exemption', count: null, module: 'Staff', seeded: true },
  { id: 'LOG-1033', time: '2026-04-26 15:10:22', admin: 'Admin Carl', adminId: 'ADM-003', action: 'BATCH_RESUBMIT', detail: 'Requested re-submission for 12 entries — Missing GPS data', count: 12, module: 'Submissions', seeded: true },
]

/** Extra history revealed by "Load older entries" — two pages of six, oldest last. */
const OLDER_LOGS: AuditLogEntry[] = [
  { id: 'LOG-1032', time: '2026-04-25 16:02:44', admin: 'Admin Rex', adminId: 'ADM-002', action: 'EVENT_CREATE', detail: 'Created event: Campus Reforestation Q2', count: null, module: 'Events', seeded: true },
  { id: 'LOG-1031', time: '2026-04-25 11:38:02', admin: 'Admin Jane', adminId: 'ADM-001', action: 'BATCH_APPROVE', detail: 'Approved 38 submissions via batch process', count: 38, module: 'Submissions', seeded: true },
  { id: 'LOG-1030', time: '2026-04-24 14:20:10', admin: 'Admin Carl', adminId: 'ADM-003', action: 'SINGLE_DECLINE', detail: 'Declined submission SUB-4409 — Reason: Tag ID Mismatch', count: 1, module: 'Submissions', seeded: true },
  { id: 'LOG-1029', time: '2026-04-24 09:05:33', admin: 'Admin Jane', adminId: 'ADM-001', action: 'EXPORT', detail: 'Exported verification log (CSV) for Arbor Day Drive 2026 — 1,612 records', count: 1612, module: 'Reports', seeded: true },
  { id: 'LOG-1028', time: '2026-04-23 15:47:19', admin: 'System', adminId: 'SYS', action: 'ALERT_SENT', detail: 'Quota warning: 3 staff below 40% completion in Arbor Day Drive 2026', count: null, module: 'System', seeded: true },
  { id: 'LOG-1027', time: '2026-04-23 10:12:00', admin: 'Admin Rex', adminId: 'ADM-002', action: 'STAFF_EXEMPT', detail: 'Removed staff STF-011 (P. Lim) from Earth Month Campaign — Graduation', count: null, module: 'Staff', seeded: true },
  { id: 'LOG-1026', time: '2026-04-22 13:28:41', admin: 'Admin Carl', adminId: 'ADM-003', action: 'BATCH_RESUBMIT', detail: 'Requested re-submission for 7 entries — Blurry photo', count: 7, module: 'Submissions', seeded: true },
  { id: 'LOG-1025', time: '2026-04-22 08:55:07', admin: 'Admin Jane', adminId: 'ADM-001', action: 'QUOTA_REASSIGN', detail: 'Bulk quota reassignment — Arbor Day Drive 2026: 4 → 5 trees/staff', count: null, module: 'Events', seeded: true },
  { id: 'LOG-1024', time: '2026-04-21 16:40:22', admin: 'Admin Rex', adminId: 'ADM-002', action: 'BATCH_APPROVE', detail: 'Approved 51 submissions via batch process', count: 51, module: 'Submissions', seeded: true },
  { id: 'LOG-1023', time: '2026-04-21 09:31:12', admin: 'Admin Jane', adminId: 'ADM-001', action: 'INCIDENT_FLAG', detail: 'Flagged high-priority incident: Pest infestation (Zone II, TRE-0950)', count: null, module: 'Submissions', seeded: true },
]

const OLDER_PAGE_SIZE = 6
const OLDER_PAGE_COUNT = Math.ceil(OLDER_LOGS.length / OLDER_PAGE_SIZE)

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 1, msg: '2 new incident reports submitted in the last hour', type: 'warning', time: Date.now() - 1000 * 60 * 45, read: true, target: { module: 'submissions', type: 'incident' } },
  { id: 2, msg: 'New submission approved: Tree planting initiative (Zone A)', type: 'info', time: Date.now() - 1000 * 60 * 60 * 2, read: true, target: { module: 'submissions' } },
  { id: 3, msg: 'Scheduled maintenance for the web map this Friday from 10:00 PM to 11:00 PM', type: 'info', time: Date.now() - 1000 * 60 * 60 * 24, read: true, target: { module: 'overview' } },
]


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Versioned key: a schema change becomes a clean miss, not a crash. */
const STORAGE_KEY = 'ecotrace_store_v1'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-04-28 10:42:31' — the MariaDB DATETIME rendering used by the log table. */
export function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** The date half of an audit-log timestamp, for the AuditLogs range filter. */
export function stampDate(stamp: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(stamp ?? '')
  return m ? m[1] : ''
}

/** 'May 15, 2026' -> Date. Returns null rather than an Invalid Date. */
export function parseDisplayDate(s: string): Date | null {
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/.exec(s ?? '')
  if (!m) return null
  const mi = MONTHS.indexOf(m[1])
  if (mi < 0) return null
  return new Date(Number(m[3]), mi, Number(m[2]))
}

export function formatDisplayDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function isoToDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return iso ?? ''
  const [y, m, d] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** School year for an ISO start date: June and later starts the new S.Y. */
function schoolYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '')
  if (!m) return '2025–2026'
  const y = Number(m[1])
  return Number(m[2]) >= 6 ? `${y}–${y + 1}` : `${y - 1}–${y}`
}

/** Stable pseudo-admin id derived from the signed-in email. */
function adminIdFor(email: string): string {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0
  return `ADM-${String((h % 900) + 100)}`
}

function nextNumberedId(existing: readonly { id: string }[], prefix: string, width: number): string {
  let max = 0
  for (const row of existing) {
    const n = Number(String(row.id).slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

/**
 * Merge persisted rows over the fixtures.
 *
 * Persisted order wins (that is where live actions live), and any fixture row
 * missing from storage is appended. The net effect: a newly shipped fixture
 * still appears on the next load instead of being shadowed by stale storage,
 * while everything the admin already did is preserved.
 */
function mergeRows<T extends { id: string | number }>(fixtures: readonly T[], persisted: unknown): T[] {
  if (!Array.isArray(persisted)) return fixtures.slice()
  const saved = persisted.filter(
    (r): r is T => !!r && typeof r === 'object' && (r as T).id !== undefined && (r as T).id !== null,
  )
  if (saved.length === 0) return fixtures.slice()
  const seen = new Set(saved.map(r => r.id))
  return [...saved, ...fixtures.filter(f => !seen.has(f.id))]
}

function seedState(): StoreSnapshot {
  return {
    submissions: SEED_SUBMISSIONS.slice(),
    events: SEED_EVENTS.slice(),
    logs: SEED_LOGS.slice(),
    notifications: SEED_NOTIFICATIONS.slice(),
    toasts: [],
    actor: null,
    olderPages: 0,
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

function readPersisted(): Partial<StoreSnapshot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<StoreSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Corrupted or unreadable storage is a clean miss, never a crash.
    return {}
  }
}

function writePersisted(s: StoreSnapshot) {
  try {
    // `toasts` and `actor` are intentionally excluded: a toast is a 3-second
    // event and the actor belongs to the current session, not to storage.
    const { toasts: _t, actor: _a, ...durable } = s
    localStorage.setItem(STORAGE_KEY, JSON.stringify(durable))
  } catch {
    /* private mode / quota — the portal still works for this session */
  }
}

/**
 * Backfill the target on any row written before notifications were clickable.
 *
 * Kept in `hydrate` rather than in a render path so the fallback is applied
 * exactly once per load, and the backfilled rows are written back to storage on
 * the admin's next write — a lazy, zero-cost migration.
 */
function withTarget(n: AppNotification): AppNotification {
  return n.target ? n : { ...n, target: LEGACY_NOTIFICATION_TARGET }
}

function hydrate(): StoreSnapshot {
  const saved = readPersisted()
  const notifications = mergeRows(SEED_NOTIFICATIONS, saved.notifications)
    .map(withTarget)
    .sort((a, b) => a.time - b.time)
  return {
    submissions: mergeRows(SEED_SUBMISSIONS, saved.submissions),
    events: mergeRows(SEED_EVENTS, saved.events),
    logs: mergeRows(SEED_LOGS, saved.logs),
    notifications,
    toasts: [],
    actor: null,
    olderPages: typeof saved.olderPages === 'number' ? saved.olderPages : 0,
  }
}


// ── The store ─────────────────────────────────────────────────────────────────

let snapshot: StoreSnapshot = hydrate()
const listeners = new Set<() => void>()

/** The current snapshot. Exported so tests and non-React callers can read state
 *  without subscribing; components should use `usePortal()` instead. */
export function getSnapshot(): StoreSnapshot {
  return snapshot
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function commit(next: StoreSnapshot) {
  snapshot = next
  writePersisted(next)
  listeners.forEach(l => l())
}

/** Apply a pure updater, persist, and notify subscribers — one atomic step. */
function set(update: (s: StoreSnapshot) => StoreSnapshot) {
  commit(update(snapshot))
}

// ── Action helpers (the fan-out lives here, not in the components) ────────────

/** Ids are derived from state, never from a module-level counter — a
 *  module-level `let` is reset by HMR and re-collides on the very next save. */
function nextNumber(seq: readonly { id: number }[]): number {
  let max = 0
  for (const row of seq) if (row.id > max) max = row.id
  return max + 1
}

function pushToast(s: StoreSnapshot, msg: string, type: 'success' | 'error'): StoreSnapshot {
  const toast: ToastMessage = { id: nextNumber(s.toasts), msg, type }
  return { ...s, toasts: [...s.toasts, toast] }
}

/**
 * `target` is a required parameter, not an optional one. Every notification is
 * clickable, and a required argument makes "forgot to add a destination" a
 * compile error at the call site rather than an inert row in the panel.
 */
function pushNotification(
  s: StoreSnapshot,
  msg: string,
  type: NotifType,
  target: NotificationTarget,
): StoreSnapshot {
  const n: AppNotification = { id: nextNumber(s.notifications), msg, type, time: Date.now(), read: false, target }
  return { ...s, notifications: [...s.notifications, n] }
}

function audit(
  s: StoreSnapshot,
  action: string,
  detail: string,
  module: string,
  count: number | null,
): StoreSnapshot {
  const entry: AuditLogEntry = {
    id: nextNumberedId(s.logs, 'LOG-', 4),
    time: formatStamp(new Date()),
    admin: s.actor?.name ?? 'System',
    adminId: s.actor?.email ? adminIdFor(s.actor.email) : 'SYS',
    action,
    detail,
    count,
    module,
    seeded: false,
  }
  return { ...s, logs: [entry, ...s.logs] }
}

/** Record an export against the audit log without touching domain state. */
function recordExport(detail: string, count: number) {
  set(s => {
    const withToast = pushToast(s, `Exported ${count.toLocaleString()} row${count === 1 ? '' : 's'}`, 'success')
    // An export is proven by its audit row, so that is where the link goes.
    return audit(pushNotification(withToast, detail, 'info', { module: 'logs' }), 'EXPORT', detail, 'Reports', count)
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface ActionResult {
  changed: number
  /** Human-readable one-liner, reused by the toast and the notification. */
  summary: string
}

type StatusVerbs = {
  single: string
  batch: string
  log: string
  note: (sub: Submission) => Partial<Submission>
}

/**
 * The shared body of Approve / Decline / Request re-submission.
 * Only `pending` rows are touched, so a double-click cannot approve twice and
 * the audit count always equals the number of rows that actually changed.
 */
function applySubmissionStatus(ids: string[], status: SubStatus, verbs: StatusVerbs): ActionResult {
  const wanted = new Set(ids)
  const targets = snapshot.submissions.filter(s => wanted.has(s.id) && s.status === 'pending')
  const changed = targets.length
  if (changed === 0) {
    const summary = 'No pending submission matched that action'
    set(s => pushToast(s, summary, 'error'))
    return { changed, summary }
  }

  const summary = `${verbs.batch} ${changed} submission${changed === 1 ? '' : 's'}`

  set(s => {
    // 1. state
    const submissions = s.submissions.map(sub =>
      wanted.has(sub.id) && sub.status === 'pending' ? { ...sub, status, ...verbs.note(sub) } : sub,
    )
    // 2. toast + notification
    const withToast = pushToast({ ...s, submissions }, summary, status === 'declined' ? 'error' : 'success')
    // One row links straight to that row's drawer; a batch links to the register,
    // narrowed to their event — but only when they actually shared one, so the
    // filter can never hide rows the admin just acted on.
    const sharedEvent = targets.every(t => t.event === targets[0].event) ? targets[0].event : undefined
    const withNotif = pushNotification(
      withToast,
      changed === 1
        ? `${verbs.single} ${targets[0].id} (${targets[0].treeTag})`
        : `${verbs.batch} ${changed} submissions`,
      status === 'declined' ? 'warning' : 'success',
      changed === 1
        ? { module: 'submissions', treeTag: targets[0].treeTag }
        : { module: 'submissions', event: sharedEvent },
    )
    // 3. audit row
    const detail =
      changed === 1
        ? `${verbs.single} submission ${targets[0].id} (${targets[0].staffName}, ${targets[0].treeTag})`
        : `${verbs.batch} ${changed} submissions: ${targets.map(t => t.id).join(', ')}`
    return audit(withNotif, verbs.log, detail, 'Submissions', changed)
  })

  return { changed, summary }
}


export const actions = {
  setActor(actor: Actor | null) {
    set(s => ({ ...s, actor }))
  },

  approveSubmissions(ids: string[]): ActionResult {
    return applySubmissionStatus(ids, 'approved', {
      single: 'Approved',
      batch: 'Approved',
      log: 'BATCH_APPROVE',
      note: () => ({}),
    })
  },

  declineSubmissions(ids: string[], reason: string, note: string): ActionResult {
    const trim = note.trim()
    const label = trim ? `${reason} — ${trim}` : reason
    return applySubmissionStatus(ids, 'declined', {
      single: 'Declined',
      batch: 'Declined',
      log: 'BATCH_DECLINE',
      note: () => ({ declineReason: reason, notes: `[${label}]` }),
    })
  },

  requestResubmit(ids: string[]): ActionResult {
    return applySubmissionStatus(ids, 'resubmit', {
      single: 'Requested re-submission for',
      batch: 'Requested re-submission for',
      log: 'BATCH_RESUBMIT',
      note: () => ({}),
    })
  },

  createEvent(draft: EventDraft, publish: boolean): PortalEvent {
    const quota = Math.max(1, Math.min(50, Number(draft.quota) || 1))
    const name = draft.title.trim() || 'Untitled Event'
    const startIso = draft.start
    const endIso = draft.end
    const event: PortalEvent = {
      id: '',
      name,
      year: schoolYear(startIso),
      start: isoToDisplay(startIso),
      end: isoToDisplay(endIso),
      startIso,
      endIso,
      quota,
      // There is no staff-assignment endpoint yet, so a new event honestly
      // starts with nobody attached and the dashboard renders '—', not a fake 0%.
      staff: 0,
      target: 0,
      verified: 0,
      pending: 0,
      incidents: 0,
      zone: draft.zone || 'Full campus map',
      status: publish ? 'active' : 'draft',
      description: draft.description,
      guidelines: draft.guidelines,
      metrics: draft.metrics,
      boundary: draft.boundary,
    }
    event.id = nextNumberedId(snapshot.events, 'E', 3)
    const summary = `${publish ? 'Published' : 'Saved draft'}: ${name}`

    set(s => {
      const withToast = pushToast({ ...s, events: [event, ...s.events] }, summary, 'success')
      const withNotif = pushNotification(withToast, summary, 'success', { module: 'events' })
      return audit(
        withNotif,
        publish ? 'EVENT_PUBLISH' : 'EVENT_CREATE',
        `${publish ? 'Published' : 'Created draft event'}: ${name} (${event.zone}, ${event.start} → ${event.end}, ${quota} trees/staff)`,
        'Events',
        null,
      )
    })
    return event
  },


  /** Move an event's end date out by `days` and re-render the display string. */
  extendEvent(eventId: string, days = 7): ActionResult {
    const ev = snapshot.events.find(e => e.id === eventId)
    if (!ev) {
      const summary = 'That event no longer exists'
      set(s => pushToast(s, summary, 'error'))
      return { changed: 0, summary }
    }
    const base = parseDisplayDate(ev.end) ?? new Date()
    const moved = new Date(base.getTime())
    moved.setDate(moved.getDate() + days)
    const newEnd = formatDisplayDate(moved)
    const summary = `Extended ${ev.name} by ${days} days → ${newEnd}`

    set(s => {
      const events = s.events.map(e => (e.id === eventId ? { ...e, end: newEnd, endIso: isoOf(moved) } : e))
      const withToast = pushToast({ ...s, events }, summary, 'success')
      const withNotif = pushNotification(withToast, summary, 'info', { module: 'events' })
      return audit(
        withNotif,
        'EVENT_EXTEND',
        `Extended event end date by ${days} days: ${ev.name} → ${newEnd}`,
        'Events',
        null,
      )
    })
    return { changed: 1, summary }
  },

  /** Bulk quota reassignment: per-staff quota and the derived target both move. */
  reassignQuotas(eventId: string, quota: number): ActionResult {
    const ev = snapshot.events.find(e => e.id === eventId)
    const nextQuota = Math.max(1, Math.min(50, Math.round(quota) || 1))
    if (!ev) {
      const summary = 'That event no longer exists'
      set(s => pushToast(s, summary, 'error'))
      return { changed: 0, summary }
    }
    const summary = `${ev.name}: ${ev.quota} → ${nextQuota} trees/staff`

    set(s => {
      const events = s.events.map(e =>
        e.id === eventId ? { ...e, quota: nextQuota, target: nextQuota * e.staff } : e,
      )
      const withToast = pushToast({ ...s, events }, summary, 'success')
      const withNotif = pushNotification(withToast, summary, 'info', { module: 'events' })
      return audit(
        withNotif,
        'QUOTA_REASSIGN',
        `Bulk quota reassignment — ${ev.name}: ${ev.quota} → ${nextQuota} trees/staff (target ${ev.target} → ${nextQuota * ev.staff})`,
        'Events',
        null,
      )
    })
    return { changed: 1, summary }
  },

  /** Reveal the next page of history. Returns how many rows were added. */
  loadOlderLogs(): number {
    if (snapshot.olderPages >= OLDER_PAGE_COUNT) return 0
    const page = OLDER_LOGS.slice(snapshot.olderPages * OLDER_PAGE_SIZE, (snapshot.olderPages + 1) * OLDER_PAGE_SIZE)
    if (page.length === 0) return 0
    // Sorting rather than a plain prepend: the second page is *older* than the
    // first, so prepending it would put the oldest row at the top. `time` is a
    // fixed-width `YYYY-MM-DD HH:mm:ss`, so a lexicographic sort is chronological.
    const merged = [...page, ...snapshot.logs].sort(
      (a, b) => b.time.localeCompare(a.time) || b.id.localeCompare(a.id),
    )
    set(s => ({ ...s, logs: merged, olderPages: s.olderPages + 1 }))
    return page.length
  },

  get olderPagesAvailable() {
    return OLDER_PAGE_COUNT
  },

  get olderPagesLoaded() {
    return snapshot.olderPages
  },

  dismissToast(id: number) {
    set(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }))
  },

  markRead(id: number) {
    set(s => ({ ...s, notifications: s.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) }))
  },

  markAllRead() {
    set(s => ({ ...s, notifications: s.notifications.map(n => (n.read ? n : { ...n, read: true })) }))
  },

  recordExport,

  /** Wipe local edits and fall back to the bundled fixtures. */
  resetDemoData() {
    set(s => {
      const fresh = seedState()
      fresh.actor = s.actor
      return pushNotification(
        pushToast(fresh, 'Demo data reset to the bundled fixtures', 'success'),
        'Local demo data was reset to the bundled fixtures',
        'info',
        { module: 'overview' },
      )
    })
  },
}


// ── React bindings ───────────────────────────────────────────────────────────

export type Module = 'overview' | 'events' | 'submissions' | 'map' | 'analytics' | 'logs'

export const MODULE_TITLES: Record<Module, string> = {
  overview: 'Overview',
  events: 'Event Management',
  submissions: 'Submissions',
  map: 'Map View',
  analytics: 'Analytics',
  logs: 'Audit Logs',
}

/**
 * A pending deep-link instruction handed to the destination pane.
 *
 * `nonce` is what makes repeat clicks work. Setting the same tree tag twice is a
 * no-op in React, so without a nonce the destination effect would fire on the
 * first click and silently do nothing on the second. Bumping it on every
 * navigate guarantees a fresh object and a fresh effect run.
 */
export interface NavFocus {
  treeTag?: string
  status?: SubStatus
  type?: SubType
  event?: string
  nonce: number
}

export interface PortalContextValue extends StoreSnapshot {
  /** Module keys visited at least once, in visit order. Drives keep-alive. */
  visited: Module[]
  active: Module
  /** Navigate, optionally leaving a deep-link instruction for the destination. */
  navigate: (m: Module, opts?: Omit<NavFocus, 'nonce'>) => void
  focus: NavFocus | null
  clearFocus: () => void
  /** Work still waiting on the admin, recomputed from state on every change. */
  attention: AttentionItem[]
  /** Derived counts — the single source for the sidebar badge and Overview. */
  pendingCount: number
  incidentCount: number
  unreadCount: number
  storeActions: typeof actions
}

const PortalContext = createContext<PortalContextValue | null>(null)

export function moduleFromHash(hash: string): Module {
  const raw = (hash ?? '').replace(/^#\/?/, '')
  return (Object.keys(MODULE_TITLES) as Module[]).includes(raw as Module) ? (raw as Module) : 'overview'
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Module>(() => moduleFromHash(window.location.hash))
  const [visited, setVisited] = useState<Module[]>([moduleFromHash(window.location.hash)])
  const [focus, setFocus] = useState<NavFocus | null>(null)
  // A ref, not state: the nonce only has to make each `focus` object distinct,
  // and routing it through state would re-render the whole tree for no visual gain.
  const nonceRef = useRef(0)

  // `useSyncExternalStore`, not useState + useEffect: concurrent renders can then
  // never tear, so a component sees either the pre-action or the post-action state.
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Keep the URL hash in step with the active module so a refresh returns to the
  // same tab and the browser Back button walks the tab history.
  useEffect(() => {
    setVisited(v => (v.includes(active) ? v : [...v, active]))
    const next = `#/${active}`
    if (window.location.hash !== next) window.location.hash = next
  }, [active])

  useEffect(() => {
    const onHashChange = () => setActive(m => (m === moduleFromHash(window.location.hash) ? m : moduleFromHash(window.location.hash)))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((m: Module, opts?: Omit<NavFocus, 'nonce'>) => {
    setActive(m)
    // A plain tab switch clears any pending focus; a deep link replaces it.
    setFocus(opts ? { ...opts, nonce: ++nonceRef.current } : null)
  }, [])

  const clearFocus = useCallback(() => setFocus(null), [])

  /**
   * Work still waiting on the admin.
   *
   * Derived on render rather than appended to the notification log, so it cannot
   * go stale: approving the last pending submission makes the item disappear,
   * with no expiry logic and no dedupe pass. Only work that is actually queued is
   * listed, and the counts are recomputed from the same arrays the rest of the
   * portal reads, so a badge and its notification can never disagree.
   */
  const attention = useMemo(
    () => attentionItems(state.submissions, state.events),
    [state],
  )

  const value = useMemo<PortalContextValue>(
    () => ({
      ...state,
      visited,
      active,
      navigate,
      focus,
      clearFocus,
      attention,
      pendingCount: state.submissions.filter(s => s.status === 'pending').length,
      incidentCount: state.submissions.filter(s => s.type === 'incident').length,
      unreadCount: state.notifications.filter(n => !n.read).length,
      storeActions: actions,
    }),
    [state, visited, active, navigate, focus, clearFocus, attention],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortal must be used inside <PortalProvider>')
  return ctx
}

/** Shorthand for components that only need the action bundle. */
export function usePortalActions(): typeof actions {
  return usePortal().storeActions
}

// ── Derived selectors ────────────────────────────────────────────────────────

/**
 * Work still waiting on the admin, derived rather than logged.
 *
 * Recomputed from the same arrays every other badge reads, so a count and the
 * notification announcing it can never disagree. Being derived is also what keeps
 * it honest: approving the last pending row makes the item vanish, with no expiry
 * pass and no dedupe rule to get wrong.
 */
export function attentionItems(submissions: Submission[], events: PortalEvent[]): AttentionItem[] {
  const items: AttentionItem[] = []
  const pending = submissions.filter(s => s.status === 'pending')
  if (pending.length > 0) {
    items.push({
      key: 'pending',
      msg: `${pending.length} submission${pending.length === 1 ? '' : 's'} awaiting review`,
      type: 'warning',
      target: { module: 'submissions', status: 'pending' },
    })
  }
  const incidents = submissions.filter(s => s.type === 'incident')
  if (incidents.length > 0) {
    items.push({
      key: 'incidents',
      msg: `${incidents.length} incident report${incidents.length === 1 ? '' : 's'} on file`,
      type: 'error',
      target: { module: 'submissions', type: 'incident' },
    })
  }
  const backlogged = events.filter(e => e.pending > 0)
  if (backlogged.length > 0) {
    const trees = backlogged.reduce((n, e) => n + e.pending, 0)
    items.push({
      key: 'backlog',
      msg: `${backlogged.length} event${backlogged.length === 1 ? '' : 's'} with ${trees.toLocaleString()} unverified submission${trees === 1 ? '' : 's'}`,
      type: 'info',
      target: { module: 'events' },
    })
  }
  return items
}

export function activeEvents(events: PortalEvent[]): PortalEvent[] {
  return events.filter(e => e.status === 'active')
}

/** Completion percentage, or null when the event has no target yet. */
export function eventProgress(ev: PortalEvent): number | null {
  if (ev.target <= 0) return null
  return Math.round((ev.verified / ev.target) * 100)
}

