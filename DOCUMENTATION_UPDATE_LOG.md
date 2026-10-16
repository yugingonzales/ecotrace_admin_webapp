# Documentation Update Summary - 2026-10-09 / 2026-10-11

## Overview

Both EcoTrace projects (Admin Portal and Flutter Mobile App) have been updated with comprehensive documentation reflecting the current state of the system.

---

## EcoTrace Admin Portal
**Location:** `C:\xampp\htdocs\projects\ecotrace_admin\`

### Files Updated

#### README.md ✅
- Added link to documentation suite
- Updated authentication section (sign-in only mode)
- Added admin account setup instructions
- Added Flutter connection section
- Added documentation index section

#### New Documentation Created (7 files)
1. **DOCS_INDEX.md** - Master navigation hub
2. **ARCHITECTURE_OVERVIEW.md** - System architecture with diagrams
3. **ADMIN_SETUP.md** - Admin account creation guide
4. **SERVER_STARTUP_AND_FLUTTER_CONNECTION.md** - Connection troubleshooting
5. **DATABASE_CONNECTION_EXPLAINED.md** - Database connection details
6. **create-admin-user.sql** - SQL script for admin account
7. **generate-hash.js** - Password hash generator utility

---

## EcoTrace Flutter Mobile App
**Location:** `c:\flutter_workspace\ecotrace\`

### Files Updated

#### README.md ✅
- Added reference to admin portal documentation
- Added Backend API and Database info to Quick facts
- Added "Connecting to Backend API" section
- Added troubleshooting reference

#### DOCUMENTATION.md ✅
- Updated "Admin integration verification" section
- Changed `npm start` to `npm run dev`
- Added detailed backend connection instructions
- Added device-specific IP configurations
- Added backend requirements checklist
- Added admin credentials reference

---

## Key Changes

### Authentication
- ✅ Admin portal is sign-in only (sign-up UI removed)
- ✅ No default admin account in database
- ✅ Manual provisioning required via SQL script
- ✅ Default credentials: `admin@ecotrace.local` / `admin123`

### Backend Connection
- ✅ Two separate databases: `ecotrace_db` (admin) vs `ecotrace_v2_test` (flutter)
- ✅ Backend runs on port 3000
- ✅ Flutter config: Android emulator uses `10.0.2.2`, physical device uses PC's LAN IP
- ✅ Complete troubleshooting guide created

### Cross-References
- ✅ Admin docs reference Flutter app
- ✅ Flutter docs reference admin troubleshooting
- ✅ Consistent terminology across projects

---

## Quick Start

### Start Backend Server
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin\server
npm run dev
```

### Configure Flutter App
```dart
// lib/core/config/api_config.dart
static const String baseUrl = 'http://10.0.2.2:3000/api';  // Emulator
// OR
static const String baseUrl = 'http://192.168.1.42:3000/api';  // Physical device
```

### Create Admin Account
1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Select database: `ecotrace_db`
3. Run SQL script: `create-admin-user.sql`
4. Login with: `admin@ecotrace.local` / `admin123`

---

## Documentation Entry Points

**Admin Portal:** Start with `DOCS_INDEX.md`  
**Flutter App:** Start with `README.md`

---

## 2026-10-11 Update — Software Changes Recorded

This entry records the software changes made **after** the 2026-10-09 documentation pass, so the guides can be re-synced to the code in a later pass. Per scope, **this file is the only documentation edited** in this session.

### 1. Drag-Resizable Admin Sidebar ✅

The navigation rail is now drag-resizable in the browser.

- `src/lib/useSidebarWidth.js` (new) — single width source of truth: `200–420px` clamp with a half-viewport cap, `localStorage` persistence (saved on drag-end only), pointer-capture dragging with rAF throttling, Escape to abort, re-clamping on window resize, Arrow / Shift+Arrow / Home / End keyboard support, and double-click reset
- `src/components/Sidebar.jsx` — the rail exposes a `role="separator"` drag handle on its right edge
- `src/App.jsx` — rail `width` and content `margin-left` are driven by a single `useSidebarWidth()` call, so a drag can never leave the two out of sync
- `src/styles/components.css` — `.eco-sidebar-*` rules
- `src/lib/useSidebarWidth.test.jsx` (new) — 53 tests; the full suite is now **111/111 passing** and `npm run build` is green (the older "58 tests" figure in `README.md` is now stale)

### 2. API Error Handler — Real Status Codes ✅

`server/src/index.js` no longer reports every error as `500`.

- The central error handler now carries the error's own `status`/`statusCode` through instead of hardcoding 500
- Client mistakes (e.g. malformed JSON rejected by body-parser) now return the true status with `error: "invalid_request"` and are **not** logged as unhandled; only real server faults (`status >= 500`) return `{ error: "internal_error", message: "Unexpected server error." }` and are logged
- Auth error contract (in `server/src/auth-controller.js`):
  - `400 invalid_request` — submitted fields failed validation
  - `401 account_not_found` — no user for the email/username
  - `401 account_unavailable` — user status is not `active`
  - `401 incorrect_password` — wrong password
  - `409 email_exists` / `username_exists` — register duplicates
  - `200` (login) / `201` (register) — `{ token, user }` on success

### 3. Login 502 — Root Cause and Restart Procedure ✅

`POST :8443/api/auth/login` returned **502 Bad Gateway** because the Node API was **not running** on `:3000`. Vite proxies `/api` → `localhost:3000`, so with no listener the proxy answered 502.

- Diagnose: `netstat -ano | findstr :3000` (empty = API is down)
- Fix: `cd server; npm run dev` (runs `node --watch src/index.js` on `0.0.0.0:3000`)
- A process started with `npm start` (`node src/index.js`) has **no auto-restart** and keeps holding `:3000`; stop it first (`Stop-Process -Id <pid>`), otherwise `npm run dev` dies with `EADDRINUSE`
- Verified end-to-end: `POST :8443/api/auth/login` `{ "email": "admin@ecotrace.local", "password": "admin123" }` → **200 + JWT** with `{ id: 2, role: "admin", status: "active" }`; `:8443/api/health` proxies green to `:3000`

---

**Updates Completed:** 2026-10-09 (documentation pass) | 2026-10-11 (software-change entry)
