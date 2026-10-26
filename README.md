# EcoTrace Admin Portal

React admin UI for the EcoTrace tree-monitoring system, backed by a
Node/MariaDB REST API.

Written in JavaScript with JSDoc types. There is no TypeScript in this project
and no typecheck step — see [Verification](#verification).

> **📚 New Documentation Available**  
> See [`DOCS_INDEX.md`](./DOCS_INDEX.md) for complete setup guides including:
> - System architecture overview
> - Server startup & Flutter app connection troubleshooting
> - Admin account creation
> - Database connection explanation

## Requirements

- **Node 22** (pinned in `.mise.toml`; use `mise install` if you have it)
- **npm** — this project standardises on npm and `package-lock.json`
- **MariaDB/MySQL** — only if you want live API data; see
  [Using the real API](#using-the-real-api)

## Setup

```bash
git clone <repo-url>
cd ecotrace_admin
npm install
cp .env.example .env.local     # optional; see below
```

`.env.local` is git-ignored. You can skip it entirely: with no `.env.local`,
`VITE_ENABLE_API` defaults to `false` and every module renders its in-memory
mock data with no network calls at all. That is the fastest way to see the UI.


## Running

The project is **two servers**. The UI works on its own, but live data needs
the API running alongside it.

**Terminal 1 — the UI (Vite):**

```bash
npm run dev
```

Runs on **:8443**, not the Vite default of 5173 — the port is set explicitly in
`vite.config.js` (override with `VITE_PORT`). Open <http://localhost:8443>.

**Terminal 2 — the API (Node), only if you want live data:**

```bash
cd server
npm install
npm run migrate     # apply server/migrations/*.sql
npm run seed        # optional: 23 demo trees
npm start           # listens on :3000
```

Vite proxies `/api` → `http://localhost:3000` automatically, so the browser
never makes a cross-origin request in development. No CORS setup needed.

Each server reads its **own** port variable, so they can no longer collide:

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `VITE_PORT` | `vite.config.js` | `8443` | UI dev/preview server |
| `API_PORT` | `server/src/index.js` | `3000` | REST API |
| `DB_*` | `server/src/db.js` | XAMPP stock | MariaDB connection |

> These used to share a single `PORT`. Because Vite runs with
> `strictPort: true`, exporting `PORT=3000` for the API also pointed Vite at
> 3000 and the dev server refused to start. That is fixed — but if you have an
> old `PORT` export in your shell, the API still honours it as a fallback so
> its behaviour does not silently change. Unset it to get the defaults above.

## Authentication and account provisioning

**Important Update (2026-10-09):** The admin portal now uses **sign-in only** authentication. 
The sign-up UI has been removed from the login screen.

### Admin Account Setup

Administrative accounts must be manually provisioned in the database. **The schema does NOT 
create any default admin accounts.**

**To create an admin account:**

1. See [`ADMIN_SETUP.md`](./ADMIN_SETUP.md) for complete instructions
2. Run the provided SQL script: [`create-admin-user.sql`](./create-admin-user.sql)
3. Default credentials: `admin@ecotrace.local` / `admin123` (change after first login)

### Authentication Flow

- **Admin Portal:** Uses `POST /api/auth/login` with admin role verification
- **Flutter App:** Uses both `/api/auth/login` and `/api/auth/register` (volunteer role)

The shared `POST /api/auth/register` endpoint remains enabled for volunteer
registration from the EcoTrace Flutter app. The backend assigns the `volunteer`
role server-side, so it cannot be used to create an administrator account.

## Using the real API

The API serves event, alert, plant, and authentication routes. Event listing is
public for the mobile schedule; participation is authenticated. To point the UI
at it:

1. Start the API on :3000 (above).
2. Set `VITE_ENABLE_API=true` in `.env.local` and restart `npm run dev`.
   Vite only reads env vars at startup.

Database connection details for the server come from the environment, not from
`.env.local` — that file is for the browser bundle only. Defaults are
`127.0.0.1:3306`, user `root`, database `ecotrace_db`. Override with `DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_NAME`, `DB_PASSWORD` in `server/.env`.

**Database Configuration:**
The backend connects to the database via `server/.env`:
```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ecotrace_db  # Use ecotrace_v2_test for Flutter app's database
```

See [`DATABASE_CONNECTION_EXPLAINED.md`](./DATABASE_CONNECTION_EXPLAINED.md) for details.

## Connecting Flutter Mobile App

The Flutter app connects to this backend API. **Important:** The app's IP configuration 
must match your development environment.

### Quick Setup

1. **Start the backend server:** `cd server && npm run dev`
2. **Find your PC's LAN IP:** `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. **Update Flutter config:** `c:\flutter_workspace\ecotrace\lib\core\config\api_config.dart`
   ```dart
   static const String baseUrl = 'http://YOUR_PC_IP:3000/api';
   ```
4. **For Android Emulator:** Use `http://10.0.2.2:3000/api`
5. **Rebuild Flutter app:** `flutter clean && flutter run`

**Troubleshooting connection issues?** See [`SERVER_STARTUP_AND_FLUTTER_CONNECTION.md`](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)

## Verification

```bash
npm run verify
```

This is **the gate** — it runs `test` then `build`, and both must pass. It is
the only check that gates this project; there is no separate typecheck to
remember, because no compiler ships with it.

Individual commands:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :8443 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm test` | Vitest suite (current count is recorded by the test runner) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run format` | oxfmt |
| `npm run verify` | **The gate** — `test` then `build` |

The API has its own suite: `cd server && npm test`. Apply database migrations
before live API verification with `cd server && npm run migrate`. The local
MariaDB/API participation smoke test was verified on 2026-10-18: migration
`011_participation.sql` was already applied, authenticated join/leave and joined
events worked, attendee counts were handled correctly, and joining produced an
event-linked published alert. The API test command currently discovers zero test
files, so this runtime smoke test is the available participation evidence.

### Event participation and alerts

The mobile event contract is:

- `GET /api/events` (the mobile app requests `?status=active`) lists events.
- `GET /api/events/joined` requires `Authorization: Bearer <JWT>` and returns the
  current user's joined events.
- `POST /api/events/:id/join` requires authentication, records participation,
  increments `attendee_count`, and creates an event-linked alert.
- `DELETE /api/events/:id/join` requires authentication, marks participation as
  `cancelled`, and decrements `attendee_count` without going below zero.
- `GET /api/alerts` returns published alerts; event context is included when
  available. The Flutter client also sends the bearer token on this request.

Migration `server/migrations/011_participation.sql` creates
`ecotrace_event_participation`, with a unique `(event_id, user_id)` key,
`joined`/`cancelled` status, timestamps, and foreign keys to events and users.
Apply it before exercising the participation routes. The joined-event response
currently reports `verified_trees: 0` until verification aggregation is added.

### On types

The codebase is JavaScript annotated with JSDoc, and the schema is mirrored in
`jsconfig.json`. `jsconfig.json` is **editor configuration only** — no build or
CI step runs it, and there is no `tsc` in the tree. It exists so VS Code
IntelliSense and go-to-definition work.

The JSDoc annotations are still worth maintaining: they document the schema
mirror and the call-site contracts, and an editor with `checkJs` enabled will
honour them again at any time. What was lost by dropping the compiler is
enforcement, not documentation — nothing now *verifies* those types at build
time.

## Project layout

```
src/                  React app (JavaScript + JSDoc, .js / .jsx)
  components/         UI components, including modules/ for each screen
  lib/                api.js (REST client), store.jsx (state), plus tests
server/               Read-only Express 5 + MariaDB REST API
  migrations/         SQL, applied by `npm run migrate`
  scripts/            Seed generator
  test/               API tests
.figma/make/          Design-tooling scripts and Vite plugins
```

## Documentation

Complete guides are available in the root directory:

- **[DOCS_INDEX.md](./DOCS_INDEX.md)** - Start here for navigation to all guides
- **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - System architecture with diagrams
- **[ADMIN_SETUP.md](./ADMIN_SETUP.md)** - Admin account creation guide
- **[SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)** - Server startup & troubleshooting
- **[DATABASE_CONNECTION_EXPLAINED.md](./DATABASE_CONNECTION_EXPLAINED.md)** - Database connection details

## Historical context

[`INTEGRATION_PROGRESS_LOG.md`](INTEGRATION_PROGRESS_LOG.md) is a long-running
audit log: it records the findings of each review pass, the bugs found and
fixed, and the reasoning behind non-obvious decisions. It is worth reading
before changing anything in `src/lib/`, because several current behaviours
exist specifically to work around problems it documents.

Most recently it covers the TypeScript → JavaScript migration (§11) and the
API integration (§7–§9). It is a historical record, not a setup guide — this
README is the entry point for running the project.

---

**Last Updated:** 2026-10-16
