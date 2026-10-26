# EcoTrace Admin Documentation Index

Start here for the separate EcoTrace admin webapp and Node/MariaDB API.

## Run and configure

- [README.md](./README.md) — project setup, API usage, Flutter connection, and verification
- [ADMIN_SETUP.md](./ADMIN_SETUP.md) — provision an administrator account
- [SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md) — start the API and troubleshoot device connectivity
- [DATABASE_CONNECTION_EXPLAINED.md](./DATABASE_CONNECTION_EXPLAINED.md) — browser/server database configuration

## Architecture and history

- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) — application and API boundaries
- [INTEGRATION_PROGRESS_LOG.md](./INTEGRATION_PROGRESS_LOG.md) — historical implementation audit
- [DOCUMENTATION_UPDATE_LOG.md](./DOCUMENTATION_UPDATE_LOG.md) — documentation and software-change record

## Current event participation contract

- Migration: `server/migrations/011_participation.sql`
- Routes: `GET /api/events`, `GET /api/events/joined`, `POST /api/events/:id/join`, and `DELETE /api/events/:id/join`
- Alerts: `GET /api/alerts`; joining an event creates an event-linked published alert
- Authentication: joined-event, join/leave, and Flutter alert requests use `Authorization: Bearer <JWT>`

Apply migrations with:

```bash
cd server
npm run migrate
```

The admin webapp and Flutter mobile app remain separate projects. The Flutter
application is documented at `C:\flutter_workspace\ecotrace\README.md`.