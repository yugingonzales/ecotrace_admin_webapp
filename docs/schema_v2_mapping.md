## Authentication schema

Authentication is intentionally independent of organizations and staff identity.
The `users` table uses `username` for login and contains no `org_id`,
`staff_code`, `failed_login_attempts`, or `locked_until`. Account availability
is controlled by the `status` column. The executable definition is
`server/migrations/007_authentication.sql`.