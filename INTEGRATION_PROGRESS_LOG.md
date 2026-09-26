# EcoTrace Integration — Progress Log

**Scope:** `ecotrace_admin` (React) · Flutter mobile app · MariaDB `ecotrace_db`
**Audit date:** 2026-09-26
**Pass:** Option A — findings documentation, coordinate bug fix, inert typed API scaffold
**Latest pass:** TypeScript → JavaScript (JSDoc) migration, TypeScript removed
entirely (see §11). Before that: clickable notifications + live "Needs
attention" block (§10)
**Status:** A **read-only** Node/MariaDB REST API exists (`server/`, Express-free, on
:3000) and `MapView` reads from it via `GET /api/plants`. It is read-only **by
design** — there is no write path, so approvals, declines and event edits are
persisted in a browser-local store (`src/lib/store.jsx`) and are **not** yet
written to MariaDB.

---

## 1. Headline finding

> **Historical — this section described the state *before* the API was built.**
> It is kept for the audit trail. See §1.2 for the corrected picture.

**There is no backend.** All three tiers currently disagree about what EcoTrace *is*:

| Tier | What it actually is | State |
|---|---|---|
| `ecotrace_admin` (React) | UI prototype | 100% hardcoded mock arrays |
| Flutter app | UI prototype | 100% hardcoded mock models |
| `ecotrace_db` (MariaDB) | Real, complete, **unreferenced** schema | 7 tables, 3 views, 2 triggers |

The database is the only piece that is real. Nothing points at it, and it was
built for a **student**-centric model while both apps are **staff**-centric.
This is the single most important thing to know before planning further work.

### 1.1 Evidence for the negative findings

Each claim below was verified by searching, not inferred.

| Claim | How it was verified | Result |
|---|---|---|
| Admin makes no HTTP calls | Searched all 33 files under `src/` for `fetch(`, `axios`, `XMLHttpRequest`, `WebSocket`, `EventSource` | **0 matches** |
| Admin has no env config | `Get-ChildItem -Force` at project root | No `.env*` file of any kind |
| Admin has no state library | `package.json` dependencies | No Redux/Zustand/Jotai/React Query — only React + Vite |
| Flutter makes no HTTP calls | `pubspec.yaml` and `pubspec.lock` | **No `http`, no `dio`, no `chopper`** in either file |
| Nothing references `ecotrace_db` | Searched both codebases for `ecotrace`, `mysql`, `3306`, `localhost` | No connection string anywhere |

The absence of `http`/`dio` in `pubspec.lock` is the strongest single piece of
evidence: `pubspec.lock` is auto-generated and fully resolved, so a transitive
HTTP client would appear there even if the app never imported it directly.
There is none — the Flutter app genuinely cannot talk to a network today.

### 1.2 Corrected picture (as of the read-only API pass)

| Tier | What it actually is | State |
|---|---|---|
| `ecotrace_admin` (React) | Working UI on a **read-only** API | Reads plants from MariaDB; writes go to a browser-local store |
| Flutter app | UI prototype | 100% hardcoded mock models |
| `ecotrace_db` (MariaDB) | Real, complete schema, **referenced** | 7 tables, 3 views, 2 triggers; read by `GET /api/plants` |

What changed: `server/` now serves a parameterised, read-only REST surface backed
by a real MariaDB connection pool, `MapView` consumes it through `usePlants()`
(behind `VITE_ENABLE_API`, with the local `trees.js` fixture as a documented
fallback so the map is never empty), and the admin's write actions persist to
`localStorage` instead of a non-existent write endpoint. That last point is the
honest limitation: **the portal cannot yet save an approval to the database**, and
the UI says so in a banner rather than implying otherwise.

---

## 2. Connection Status Matrix

> Rows marked **[updated]** were re-verified against a running system; the rest
> are the original audit's findings.

| Component | Expected | Actual | Action needed |
|---|---|---|---|
| Node.js | ≥ 20 | **v24.16.0** | None — ready |
| npm | present | present | None |
| MariaDB client | on PATH | `C:\xampp\mysql\bin\mysql.exe` (10.4.32) | None |
| MySQL service | running | **running** **[updated]** | None — `server/test` reaches it |
| Apache service | running | **stopped** | Only if serving via XAMPP |
| `ecotrace_db` | exists | **exists**, 7 tables / 3 views / 2 triggers | None |
| REST API on :3000 | serving | **serving, read-only** **[updated]** | Write endpoints still to be built |
| Admin dev server | :8443 | configured (`vite.config.js`, `strictPort`) | None |
| `/api` proxy | → :3000 | **configured** (`vite.config.js`, dev + preview) | None |
| Flutter `http` dep | declared | **absent** | Add when mobile is wired up |

The database was inspected **offline** by decoding the InnoDB `.frm` files
directly, so the MySQL service being stopped did not block the audit.

---

## 3. Schema inventory (`ecotrace_db`)

### 3.1 Tables

| Table | Primary key | Notes |
|---|---|---|
| `ecotrace_students` | `student_id` | `email` UNIQUE, `password_hash`, `year_batch`, `is_active`, `email_verified`, `last_login_at` |
| `ecotrace_plants` | `plant_id` | `latitude`/`longitude` with CHECK bounds, `plant_status` ENUM, `verification_count`, `last_verified_at` |
| `ecotrace_events` | `event_id` | `trees_per_student`, `target_year_batch`, `event_status` ENUM, CHECK `end_date >= start_date` |
| `ecotrace_event_tasks` | `task_id` | Composite unique `(event_id, plant_id, student_id)`; `task_status` ENUM |
| `ecotrace_plant_verifications` | `verification_id` | `health_status` + `plant_stage` ENUMs, measurement columns, pest/disease/water/fertilizer flags |
| `ecotrace_verification_photos` | `photo_id` | `photo_url`, `photo_type` ENUM, `mime_type`, `file_size_bytes` |
| `ecotrace_plant_reservations` | `reservation_id` | `expires_at`, `is_active`, `released_at` |

### 3.2 Views and triggers

- **Views:** `vw_active_plants`, `vw_event_progress`, `vw_student_progress`
- **Triggers:** `tr_update_student_login`, `tr_validate_event_dates`

The views are genuinely useful — they already pre-aggregate event and student
progress, which is exactly what the Overview and Analytics modules need.

### 3.3 Constraints worth knowing before writing SQL

- `chk_latitude` / `chk_longitude` — malformed coordinate inserts are rejected by
  the database, not the app. Good.
- `chk_height_positive`, `chk_circumference_positive`, `chk_canopy_positive`
- `chk_date_range`, `chk_trees_positive`
- `tr_validate_event_dates` duplicates the `chk_date_range` constraint at the
  trigger level — belt-and-braces, harmless.

All ENUM values in `src/lib/types.js` were copied verbatim from these `.frm`
definitions. None were invented.

---

## 4. The five schema gaps

These block live integration. Each is a place where the apps show a feature the
database cannot store.

### Gap 1 — No staff table and no `role` column *(blocking)*

Both apps model **staff** with three roles: `intern`, `volunteer`, `staff`.
`SubmissionsView.jsx` carries `staffId: 'STF-001'`, `staffType: 'Volunteer'` on
every row. The database has **no users table and no `role` column anywhere** —
only `ecotrace_students`, which is a different thing entirely.

This is the gap that blocks persisting the `paidVolunteer → volunteer` rename.
The string `"volunteer"` exists in the apps but has nowhere to live.

Note the collision: `ecotrace_students` already occupies the identity/auth slot
(`email`, `password_hash`). We cannot simply bolt a role column onto it — staff
and students are different populations, and the apps' `STF-###` IDs are a
separate sequence from `student_id`. See §8.5 for the proposed resolution.

### Gap 2 — No incidents table

`Overview.tsx` displays a hardcoded **"12 Incident Reports"**. The Flutter app
has a dedicated `incident_report.dart` screen. `SubmissionsView.jsx` has an
`incident` submission type with `incidentType` values
(`Dead / Uprooted Tree`, `Pest Infestation`, `Location Mismatch`).

The nearest fit is `ecotrace_plant_verifications.health_status = 'damaged' |
'deceased'`, but that discards `incidentType` entirely and cannot distinguish a
pest report from an uprooting. **Provisional mapping only.**

### Gap 3 — No audit-log table

`AuditLogs.tsx` renders a static list of admin actions. Nothing records who
changed what. For a system that approves/rejects submissions and edits event
deadlines, this is a compliance gap, not merely a missing feature.

### Gap 4 — No boundary/polygon storage

`EventBoundaryEditor` lets a user draw a polygon on a map, but no column
anywhere persists the result. Validating a submission's coordinates against a
zone boundary — the entire point of the feature — is currently impossible.

### Gap 5 — Ambiguous "Arbor Day target 2250"

The Overview shows a target of **2250** trees. `ecotrace_events` has no
target-tree-count column. The only derivable figure is:

```
target = trees_per_student × COUNT(students WHERE year_batch = target_year_batch)
```

Whether 2250 means that product, a manually-set campaign goal, or a
campus-wide lifetime total is **unresolved and needs a human decision.**
Guessing here would silently corrupt the headline metric.

---

## 5. Data bug fixed: submission coordinates

**The bug.** `SubmissionsView.jsx` seeded all 8 submissions at
`14.65xx N / 121.04xx E` — that is **Quezon City, ~600 km from the campus**.
Every other coordinate source in the project uses the UEP Catarman, Northern
Samar campus: `lib/trees.ts` (12.50xx / 124.66xx), `lib/site.ts` (zone
centroids at 12.5096–12.5131 / 124.6609–124.6674), and Flutter's
`campus_data.dart`.

**Why it mattered.** Any point-in-polygon validation would reject 8 of 8
submissions as outside campus bounds. The bug was latent only because no
validation exists yet — it would have surfaced the instant a backend was
connected.

**The fix.** Each submission's coordinates are now derived from its matching
`treeTag` in `lib/trees.ts`, so a submission and its map marker resolve to the
identical point:

| treeTag | Before | After | `lib/trees.ts` |
|---|---|---|---|
| TRE-0892 | 14.6591, 121.0437 | **12.5101, 124.6679** | ✓ match |
| TRE-0567 | 14.6588, 121.0441 | **12.5098, 124.6681** | ✓ match |
| TRE-1204 | 14.6594, 121.0429 | **12.5092, 124.6677** | ✓ match |
| TRE-0341 | 14.6579, 121.0452 | **12.5100, 124.6671** | ✓ match (`12.51`) |
| TRE-0783 | 14.6601, 121.0415 | **12.5135, 124.6616** | ✓ match |
| TRE-1108 | 14.6585, 121.0460 | **12.5094, 124.6671** | ✓ match |
| TRE-0223 | 14.6577, 121.0445 | **12.5105, 124.6676** | ✓ match |
| TRE-0950 | 14.6596, 121.0432 | **12.5128, 124.6617** | ✓ match |

### 5.1 Zone naming drift *(not yet fixed — needs a decision)*

The admin portal labels zones **Zone I / II / III**. The Flutter app and the
database-facing copy use **Zone A / B / C**. `lib/site.ts` and `lib/trees.ts`
both use Roman numerals, so the admin is the majority convention. This needs a
product decision before any zone-validated query is written — it is not a
mechanical rename, because zone names may be user-facing labels.

---

## 6. Security posture (must be fixed before any deployment)

`Login.jsx` is a prototype-grade auth flow and is **not safe to ship**:

- **Hardcoded credentials** — `admin@school.edu` / `admin123` sit in the source.
- **Plaintext passwords at rest** — accounts are persisted to `localStorage`
  under the key `ecotrace_admin_accounts` with no hashing.
- **Fake latency** — a `setTimeout` simulates a network round-trip.
- **No token, no expiry, no server** — there is nothing to forge or revoke.

By contrast, the database is already built correctly for this: it has
`password_hash` on `ecotrace_students` plus a `tr_update_student_login`
trigger to maintain `last_login_at`. **The database model is right; the admin
portal's client-side auth is what needs replacing.** When the API lands, this
component should be deleted and rewired to `login()` in `src/lib/api.js`.

### 6.1 ID mismatch

Admin mock IDs (`SUB-4421`, `TRE-0892`, `STF-001`) are display strings with no
correspondence to the database's auto-increment primary keys. Real API responses
will return `plant_id: 42`, not `'TRE-0892'`. Components will need a mapping
step, or the mock IDs should be retired in favour of numeric IDs.

---

## 7. Delivered this pass

| File | Action | Purpose |
|---|---|---|
| `INTEGRATION_PROGRESS_LOG.md` | created | This document |
| `src/lib/types.ts` | created | TS types decoded from the real `.frm` schema |
| `src/lib/api.ts` | created | Inert typed REST client |
| `.env.example` | created | Documented env keys, no secrets |
| `src/vite-env.d.ts` | edited | Typed `ImportMetaEnv` for the `VITE_*` vars |
| `src/components/modules/SubmissionsView.tsx` | edited | Coordinate bug fix (§5) |
| `vite.config.ts` | edited | `/api` → `localhost:3000` proxy |

*Historical. The figure below is from that pass. §11.5 holds the current bundle
size; the summary at the end of the change log repeats it.*

**Verification (at the time):** `npx tsc --noEmit` exits 0; `npx vite build` succeeds
(833 kB bundle / 240 kB gzipped, chunk-size warning only).

### 7.1 Why the API client is inert

`src/lib/api.js` defines the full typed contract but **dispatches no requests**
while `VITE_ENABLE_API` is not `'true'` — `request()` throws `ApiError` with
status `0` before reaching `fetch`. This is deliberate:

1. No backend exists, so any real call would fail in the UI.
2. The portal must keep rendering its mock data untouched until migration.
3. The contract can be reviewed and agreed on independently of server work.

Once the API is live, migrating a module is a matter of replacing its mock
array with the matching helper in `api.js` — no other change to that component.

---

## 8. Proposed API architecture (design only — not built this pass)

### 8.1 Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js v24.16.0 | Already installed |
| Framework | Express 5 | Current stable; async error propagation |
| DB driver | `mysql2` (promise pool) | Native prepared statements, avoids SQL injection |
| Auth | `jsonwebtoken` + `bcryptjs` | `bcryptjs` is pure JS — no native build step |
| Validation | `zod` | Schema shared with the TS types in `src/lib/types.js` |
| Port | **3000** | Admin dev server already owns 8443 |

### 8.2 Request flow

```
Admin (React) ──/api/*──▶ Vite dev proxy (:8443 → :3000)
                              │
                              ▼
                       Express 5 (:3000)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              zod validation     jwt.verify (Bearer)
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    mysql2 promise pool
                              │
                              ▼
                    MariaDB ecotrace_db
```

Proxied under `/api` so the browser never makes a cross-origin request in
development — no CORS configuration required. In production, terminate the same
path at nginx/IIS or set `VITE_API_BASE_URL` to an absolute origin.

### 8.3 JWT lifecycle

1. `POST /api/auth/login` → verify `password_hash` with `bcrypt.compare`.
2. Issue a JWT carrying `{ sub: student_id, email, role }`, 8 h expiry.
3. Client stores it in `localStorage` under `ecotrace_admin_token` (a **separate
   key from the legacy `ecotrace_admin_accounts`**, which must be purged on first
   live login).
4. Every request sends `Authorization: Bearer <token>`; `api.js` does this
   automatically.
5. `tr_update_student_login` maintains `last_login_at` on success.
6. On 401, the client clears the token and returns to the login screen.

### 8.4 REST route mapping

Backed by `src/lib/api.js`. Every route is implemented server-side; none are
called by the app yet.

| Method | Route | Backing table / view | Helper |
|---|---|---|---|
| GET | `/api/health` | — (liveness + DB ping) | `health()` |
| POST | `/api/auth/login` | `ecotrace_students` | `login()` |
| GET | `/api/auth/me` | `ecotrace_students` | `me()` |
| GET | `/api/overview` | aggregate + 3 views | `getOverviewStats()` |
| GET | `/api/plants` | `ecotrace_plants` | `listPlants()` |
| GET | `/api/plants/:id` | `ecotrace_plants` | `getPlant()` |
| POST | `/api/plants` | `ecotrace_plants` | `createPlant()` |
| PATCH | `/api/plants/:id` | `ecotrace_plants` | `updatePlant()` |
| GET | `/api/events` | `ecotrace_events` | `listEvents()` |
| POST | `/api/events` | `ecotrace_events` | `createEvent()` |
| PATCH | `/api/events/:id` | `ecotrace_events` | `updateEvent()` |
| GET | `/api/events/progress` | `vw_event_progress` | `getEventProgress()` |
| GET | `/api/verifications` | `ecotrace_plant_verifications` | `listVerifications()` |

### 8.5 Migration SQL for the five missing tables

**Draft — not applied.** Presented for review. The `role` ENUM in Gap 1 is the
decision most in need of sign-off, since it determines whether staff become a
separate table or an extension of students.

```sql
-- Gap 1: staff identities. Separate from ecotrace_students because staff and
-- students are different populations with different ID sequences (STF-### vs
-- student_id). `role` values match the apps: 'intern' | 'volunteer' | 'staff'.
CREATE TABLE ecotrace_staff (
  staff_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_code    VARCHAR(16)  NOT NULL COMMENT 'Display id, e.g. STF-001',
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt',
  role          ENUM('intern','volunteer','staff') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id),
  UNIQUE KEY uq_staff_email (email),
  UNIQUE KEY uq_staff_code (staff_code),
  KEY idx_staff_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gap 2: incidents. `incident_type` preserves the distinctions the
-- health_status ENUM cannot make (pest vs. uprooted vs. location mismatch).
CREATE TABLE ecotrace_incidents (
  incident_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  plant_id      INT UNSIGNED NULL,
  event_id      INT UNSIGNED NULL,
  reported_by   INT UNSIGNED NULL COMMENT 'FK ecotrace_staff.staff_id',
  incident_type ENUM('dead_uprooted','pest_infestation','location_mismatch',
                     'damage','other') NOT NULL,
  severity      ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  description   TEXT         NULL,
  photo_url     VARCHAR(500) NULL,
  status        ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
  reviewed_by   INT UNSIGNED NULL COMMENT 'FK ecotrace_staff.staff_id',
  reviewed_at   DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (incident_id),
  KEY idx_incident_status (status),
  KEY idx_incident_plant (plant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gap 3: audit trail for admin actions.
CREATE TABLE ecotrace_audit_logs (
  audit_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    INT UNSIGNED    NULL,
  actor_email VARCHAR(190)    NULL,
  action      VARCHAR(64)     NOT NULL COMMENT 'e.g. approve_submission',
  entity_type VARCHAR(48)     NOT NULL COMMENT 'e.g. event, plant',
  entity_id   INT UNSIGNED    NULL,
  details     JSON            NULL,
  ip_address  VARCHAR(45)     NULL COMMENT '45 = IPv6 max',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  KEY idx_audit_actor (actor_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gap 4: zone boundaries. Points are stored as JSON [[lng,lat], ...] which
-- PostGIS/ST_Contains can consume directly, and avoids requiring the spatial
-- extension for a first implementation.
CREATE TABLE ecotrace_event_boundaries (
  boundary_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    INT UNSIGNED NOT NULL,
  zone_name   VARCHAR(48)  NOT NULL COMMENT 'Zone I/II/III - see naming drift',
  polygon     JSON         NOT NULL COMMENT '[[lng,lat], ...] closed ring',
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (boundary_id),
  UNIQUE KEY uq_boundary_event_zone (event_id, zone_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gap 5: explicit campaign target, so "2250" stops being ambiguous.
-- Alternative (rejected): derive it as trees_per_student x cohort size, which
-- is correct but drifts as enrolment changes. A headline metric should not
-- silently change; storing it explicitly also settles what 2250 refers to.
ALTER TABLE ecotrace_events
  ADD COLUMN target_tree_count INT UNSIGNED NULL
    COMMENT 'Explicit campaign goal; NULL = derive from trees_per_student x cohort';
```

Foreign keys are deliberately **omitted** above. The existing tables already use
logical references (`created_by`, `student_id`) without enforced FKs, and adding
constraints retroactively would first require a data-integrity pass over
existing rows. Recommend adding them as a separate, deliberate migration.

---

## 9. Open questions — decisions needed before backend work

These are **not** technical unknowns. Each needs a human answer because either
the code is ambiguous or the data would be silently wrong.

| # | Question | Why it blocks | Recommendation |
|---|---|---|---|
| 1 | Are staff a **separate table** from students, or students with a role? | Determines Gap 1, the `Volunteer` rename, and the entire auth model | Separate `ecotrace_staff` table — see §8.5 |
| 2 | What does "Arbor Day target **2250**" actually mean? | The Overview's headline metric derives from it | Add explicit `target_tree_count`; confirm 2250 is a campaign goal |
| 3 | Zones: **I/II/III** or **A/B/C**? | Needed before any zone-validated query | Roman numerals (admin + `lib/` majority); align Flutter |
| 4 | Should incidents be a real table, or a `health_status` view? | Gap 2; determines whether `incidentType` survives | Real table — the ENUM loses too much |
| 5 | Do staff log into the admin portal, or only the mobile app? | Changes whether the JWT subject is a student or a staff member | Clarify — affects every route's authorization |
| 6 | Is the **Flutter app** in scope for the backend contract? | Affects whether the API is mobile-first or admin-first | Define both; shared `/auth` and `/plants` |

### 9.1 Recommended next steps, in order

1. **Answer questions 1–3.** Cheap to answer, and everything else depends on them.
2. **Scaffold the Express service** — `express`, `mysql2`, `zod`,
   `jsonwebtoken`, `bcryptjs`; health-check `ecotrace_db` first.
3. **Start MySQL** (`net start MySQL`) and apply migrations from §8.5 once approved.
4. **Implement `/api/auth/login` and `/api/plants`** — the two smallest vertical
   slices that prove the stack end to end.
5. **Swap `Login.jsx` to `login()`** and delete the plaintext
   `ecotrace_admin_accounts` localStorage path.
6. **Migrate Overview → `getOverviewStats()`**, verifying numbers against
   `vw_event_progress` and `vw_student_progress`.
7. **Enable the client** by setting `VITE_ENABLE_API=true` in `.env.local`.
8. **Then the Flutter app:** add `http` to `pubspec.yaml`, build a matching
   typed client.

---

## 10. Clickable notifications + "Needs attention"

### 10.1 The finding that shaped this

All six `pushNotification` call sites were **confirmations of just-completed
work** — "approved 3 submissions". Nothing ever told the admin what was still
*waiting*. Meanwhile `pendingCount` and `incidentCount` already existed and
badged the sidebar but never became notifications. So the ask ("make
notifications clickable") implied a new category, not just clickable rows.

### 10.2 Design decisions worth keeping

**A discriminated union beats a bag of optional fields.** `NotificationTarget`
is `submissions` (carrying `status` / `type` / `treeTag` / `event`), `events`,
`map`, plus an `Exclude<Module, …>` catch-all so a module added later is
targetable without touching this type. The point is that an impossible target —
a `status` filter on a map link — is a **compile error**, not a link that
silently does nothing.

**Required parameter as a linter you can't forget.** `target` is *required* on
`pushNotification(...)` but *optional* on the stored `AppNotification`. The
enforcement is at the call site, the tolerance is in the data: a call site that
forgets a target fails `tsc`, while rows written by older builds still parse.
`LEGACY_NOTIFICATION_TARGET` (`{ module: 'overview' }`) is applied in
`hydrate()` via `withTarget()` — a lazy, zero-cost migration written back on the
next store write.

**React state equality silently breaks repeat deep-links.** Replacing
`focusTreeTag`/`clearFocusTreeTag` with `focus`/`clearFocus` carrying a
`NavFocus { …fields, nonce }` was not a rename. `setFocusTreeTag('TAG-1')` twice
is a **no-op**, so the destination effect stopped firing on the second click —
approving a row and re-clicking the notification would not reopen its drawer.
The monotonic `nonce` (held in a `useRef`, not state, since it only needs to make
each object distinct) is the fix. Same class of bug as the `nextNumber` HMR
comment already in that file.

**Derive "needs attention", don't log it.** `attentionItems(submissions, events)`
is a pure function computed in the provider. Synthesising it into the log would
inherit dedupe, expiry and staleness — a notification reading "7 waiting" after
5 are approved is simply a lie. Live derivation is self-resolving and reads the
same arrays the sidebar badges read, so a count and its notification **cannot
disagree**. It yields: pending submissions, incident reports, and events with an
unverified backlog.

**Batch decisions only narrow when they can.** A multi-row decision targets the
shared `event` when every row belongs to one, and otherwise carries **no**
filter — narrowing to either event would hide rows just acted on. Single-row
decisions target the `treeTag` and open that row's drawer.

**Deliberately not invented:** an event-id focus mechanism for the Events page.
`{ module: 'events' }` carries no focus fields, because promising one would be a
link that lands on the right page without doing what it says.

### 10.3 Judgement calls awaiting a one-word confirmation

1. **Export notifications link to `logs`** (there is no downloads page). If they
   should not link at all, drop the chevron for that row type.
2. **The Needs-attention block is kept**, which means notifications now include
   queued work rather than being strictly retrospective. Remove `attentionItems`
   from the panel if that is wrong.

### 10.4 Verification limit

jsdom has no layout engine, so **no test asserts paint order, chevron affordance
or drawer re-opening** — only that the instruction handed to the destination is
correct and object-distinct. The three map z-index checks and the panel's
visual behaviour remain manual.

## 11. Change log

| Date | Change | Files |
|---|---|---|
| 2026-09-26 | 3-phase read-only audit completed; no backend found | — |
| 2026-09-26 | Schema decoded from `.frm` files (offline) | — |
| 2026-09-26 | Connection Status Matrix delivered | — |
| 2026-09-26 | Fixed submission coordinates (Quezon City → UEP Catarman) | `SubmissionsView.tsx` |
| 2026-09-26 | Added typed schema layer | `src/lib/types.ts` |
| 2026-09-26 | Added inert typed API client | `src/lib/api.ts` |
| 2026-09-26 | Added env template | `.env.example` |
| 2026-09-26 | Typed `ImportMetaEnv` | `src/vite-env.d.ts` |
| 2026-09-26 | Added `/api` → `localhost:3000` proxy | `vite.config.ts` |
| 2026-09-26 | This document created | `INTEGRATION_PROGRESS_LOG.md` |
| 2026-09-26 | Built the read-only MariaDB REST API (13 tests) | `server/` |
| 2026-09-26 | Wired `MapView` to the API with a fixture fallback | `src/lib/usePlants.ts` |
| 2026-09-26 | Added the shared client store and rewired all 19 dead buttons | `src/lib/store.tsx` |
| 2026-09-26 | Added the CSV helper behind every Export button | `src/lib/csv.ts` |
| 2026-09-26 | Added store + CSV unit tests (31) | `src/lib/*.test.ts` |
| 2026-09-26 | Added `NotificationTarget` union + `LEGACY_NOTIFICATION_TARGET` backfill | `src/lib/store.tsx` |
| 2026-09-26 | Replaced `focusTreeTag` with `NavFocus` + nonce (repeat deep-link fix) | `src/lib/store.tsx` |
| 2026-09-26 | Added `attentionItems()` — live "Needs attention" derivation | `src/lib/store.tsx` |
| 2026-09-26 | Made every notification row clickable, with chevron + tooltip | `src/App.tsx` |
| 2026-09-26 | Routed focus into the submissions drawer / filters | `src/components/modules/SubmissionsView.tsx` |
| 2026-09-26 | Added notification-target + deep-link tests (14) | `src/lib/store.test.ts`, `src/lib/notificationTargets.test.tsx` |
| 2026-09-26 | Un-ignored `.env.example` — the template had never been committed | `.gitignore` |
| 2026-09-26 | TS→JS migration **complete**: all 28 `src/` files converted to JSDoc, TypeScript removed entirely (no `.ts`/`.tsx` in the repo), 3 hardcoded-extension readers made extension-agnostic | §11 |


**Verification:** `npx vite build` → success (859.49 kB / 248.00 kB gzipped;
pre-existing chunk-size warning only). `npx vitest run` → 58/58.
`server/ npm test` → 13/13. `npm run verify` runs the last two together.
There is no longer a typecheck step — see §11.7.

**Tests were mutation-checked, not merely observed green.** Three deliberate
breakages were introduced and reverted after confirming the suite caught each
*for the right reason*: pinning `nonce: 0` → `expected 0 to be greater than 0`;
neutering `withTarget()` → `expected undefined to deeply equal { module:
'overview' }`; dropping `target` in `pushNotification` → 5 target tests failed.

*Known debt, deliberately left in place:* `planter_name` is parked in
`location_address` in the dev seed; `plant_status` conflates workflow state with
tree health; dead-tree/EcoTag reconciliation is deferred. A real `planter_name`
column should exist before this ships to production.*

*Both items previously carried forward as unconfirmed are now resolved, and
neither needed a decision:*

- **publish-requires-metrics was never a change.** The guard in
  `EventManagement` is byte-identical to the pre-migration baseline at
  `4f71968` — `git show 4f71968:src/components/modules/EventManagement.tsx`
  returns the same three lines. There was nothing to confirm, and nothing to
  flip.
- **The map notification-bleed fix is in place.** All three map roots carry
  `isolation: isolate` (`index.css`), and `mapStacking.test.js` *discovers*
  map roots rather than listing them, so a fourth unisolated map fails the
  suite. Only the visual result in a real browser remains unasserted — jsdom
  has no layout engine. That is a two-minute manual look, not a code change.

*Next pass: the "simplify the admin design" request, still not started — the
pre-audit surface is now functional, so the design pass can proceed against real
state instead of hardcoded arrays.*

---

## 11. TypeScript -> JavaScript (JSDoc) migration

**Status: COMPLETE.** All 28 `src/` files are converted. The repository now
contains **no `.ts` or `.tsx` file anywhere**, and TypeScript is no longer a
dependency. The `npm run typecheck` script has been removed along with it;
see §11.7 for what that costs and why it was accepted.

### 11.1 Why

The instructor requires JavaScript rather than TypeScript. This is an
external, non-negotiable constraint, not a technical preference, so the
migration proceeds. The goal became **comply fully without discarding the
guarantees that were load-bearing** - specifically the schema mirror in
`src/lib/types.js` and the compile-time checks on call sites.

### 11.2 Approach: JSDoc, not annotation deletion

Sources are plain `.js`/`.jsx` carrying JSDoc annotations. The mapping used
throughout was mechanical:

| TypeScript | JSDoc |
| --- | --- |
| `interface X { a: string }` | `@typedef {object} X` + `@property {string} a` |
| `type X = 'a' \| 'b'` | `@typedef {'a' \| 'b'} X` |
| `(a: A): R` | `@param {A} a` + `@returns {R}` |
| `foo as T` / `x!` / `<T>(y)` | `/** @type {T} */ (x)` |
| `interface B extends A` | `@typedef {A & {...}}` |
| `import type { T }` | `@typedef {import('./m.js').T} T` |

`tsconfig.json` was replaced by `jsconfig.json`. While the migration was in
flight that file carried `checkJs` and `npm run typecheck` ran
`tsc -p jsconfig.json --noEmit`; §11.7 records why both were then removed.

### 11.3 What was converted

All 28 files. Grouped by the construct that made them non-mechanical:

| Group | Files | Note |
| --- | --- | --- |
| Tooling | `vite.config`, `vitest.config`, `trees` | `vite.config.js` needed `@returns {Plugin}` restored on each factory, else every Vite hook param went implicit-`any` |
| Leaf utilities | `csv`, `site`, `useEscapeToClose`, `useOutsideClick` (+3 tests) | plain annotation strip |
| Schema mirror | `types.ts` -> `types.js` | 7 ENUM unions re-verified against the `.frm` files, not trusted from the old comment |
| API + data | `api`, `usePlants` | `ApiError` parameter properties have no JS equivalent |
| Components | `main`, `Sidebar`, `Login`, `ToastViewport`, `MapAutoResize`, `App`, `Overview`, `MapView`, `Analytics`, `AuditLogs`, `SubmissionsView`, `EventManagement`, `EventBoundaryEditor` | |
| State | `store.tsx` -> `store.jsx` (830 lines) | 15 exported types; done last, once types/api/csv were settled |
| Tests | `store.test`, `notificationTargets.test` (+3 already converted) | |

**`vite.config.js` needed more than a mechanical strip.** Removing the
`: Plugin` return annotations silently de-typed every Vite hook parameter
(`TS7006` implicit-any on `server`, `code`, `id`, `socket`). Restoring
`@returns {Plugin}` on each factory reinstates contextual typing, which is
the JSDoc equivalent of the original return type.

### 11.4 Three places that read source files by hardcoded extension

`src/lib/trees.*` is parsed **as text** by two files in `server/`, both of
which hardcoded the string `trees.ts`:

- `server/scripts/generate-seed.mjs` - generates `002_seed_plants.sql`
- `server/test/api.test.js` - the live-API cross-check (the test the log
  calls "the test that matters")

Renaming to `trees.js` broke the seed generator with `ENOENT`. Both now
resolve the extension instead of hardcoding one, so a future rename fails
loudly and locally instead of three frames deep. The 23 rows were kept in
their original field order and quoting because both regexes depend on it.

**Verification that this coupling is intact:** re-running the generator
reproduces the SQL with exactly one changed line - the `-- Source:` header,
now `trees.js`. All 23 data rows and the status-count line are unchanged.

The same class of coupling turned up a second time, inside the test suite.
`src/lib/mapStacking.test.js` reads `MapView.tsx`, `EventBoundaryEditor.tsx`
and `App.tsx` to assert the map stacking contract. Renaming `MapView` made the
suite fail with `ENOENT` and 2 of its 8 tests silently vanish - a test result
that looks like a stacking regression but is really an extension problem. A
`readSource()` helper now resolves an extension-less path, and the `MAP_FILES`
list is extension-free, so a rename in either direction is a no-op.

`index.html` was a third: it hardcoded `/src/main.tsx` as the entry script,
which would have shipped a build whose entry could not resolve.

### 11.5 Verification of the final state

- `npx vitest run` - **58/58** across 5 files
- `server/ npm test` - **13/13**
- `npx vite build` - **859.49 kB / 248.00 kB gz, CSS 42.35 kB**
- Seed generator - **23 trees**, reproduces the committed SQL byte-for-byte
- `Get-ChildItem -Recurse '*.ts','*.tsx'` outside `node_modules` - **none**

The build is 0.07 kB above the 859.42 kB pre-migration baseline. That delta
is deliberate and was isolated: `main.jsx` used to assert `!` on
`document.getElementById('root')`, and the assertion became a real `throw`
naming the missing mount point. Rebuilding with a plain cast instead returns
exactly 859.43 kB, confirming the error string is the whole difference.

**The types were mutation-checked while the checker still existed**, because
a green typecheck that checks nothing is worse than no typecheck:

- `PlantStatus` rejected a value outside the union; a `Plant` with a mistyped
  `plant_id` and a `Paginated` envelope missing `items` were both rejected;
  a valid `AuthSession` was accepted (proving `Omit<Student,'password_hash'>`
  still strips the credential).
- Mis-declaring `me()`'s return type **failed**, after it had silently passed
  in an earlier draft - see §11.6.

### 11.6 Two bugs the migration nearly shipped

**A return type that was decorative.** The old code bound the generic at each
call site (`request<StudentPublic>('/auth/me')`). JSDoc cannot express a
type argument, so a bare `request(...)` infers `T` as `unknown` - and
`Promise<unknown>` is assignable to *any* declared return type. The declared
types would have been unenforced while still looking enforced. Each of the 14
endpoints now casts its result, and a deliberate mis-declaration is caught
with `TS2322`.

**A generic parsed as arithmetic.** `useState<Set<string>>(new Set())` in a
`.jsx` file is not a generic call; it is a chain of comparison operators, and
it type-checks as one. The build survived it only because the malformed
expression is dead code. It appeared in `SubmissionsView`, `App` (`useRef`),
and `EventManagement` - argument casts pin the type instead.

A third, cheaper one: hoisting `import.meta.env` into a local `const env` and
reading `env.VITE_*` defeats Vite's static replacement and embeds the entire
env object (**+2.5 kB, measured**). `api.js` now keeps the fully-qualified
literal and casts inline, with a comment saying why.

### 11.7 The cost of going strict, stated plainly

The instructor's ban was read strictly: **no TypeScript at all**, tooling
included. So `src/vite-env.d.ts` is deleted (its 3 `VITE_*` keys are now cast
inline in `api.js`), the `typescript` devDependency is removed,
`checkJs`/`strict`/`noEmit` are dropped from `jsconfig.json`, and
`npm run typecheck` no longer exists. `jsconfig.json` is kept purely as
editor configuration. `npm run verify` (`test && build`) is the gate.

**What is genuinely lost:** there is no longer any automated check that a
`PlantStatus` literal, a `NotificationTarget` arm, or an API return type is
correct. The JSDoc is still in the source and still documents every one of
those contracts, and an editor with `checkJs` switched on will enforce them
again - but nothing in the build or the test run will catch a violation.
The 58 tests are the only automated guard that remains.

This was a deliberate trade, made after the alternative (keep `checkJs`) was
put to the instructor's representative. It is the one place where the
migration reduced a safety net, and it is recorded here so the trade can be
reversed if the reading of "no TypeScript" turns out to mean source files only.

