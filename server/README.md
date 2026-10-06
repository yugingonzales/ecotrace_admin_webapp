# EcoTrace API database setup

The API uses the existing XAMPP/MariaDB configuration in `server/.env`:
`DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, and
`DB_NAME=ecotrace_db`.

## Fresh rebuild

1. Export a backup before proceeding.
2. Ensure the XAMPP MariaDB service is running.
3. From this directory run:

```powershell
$env:CONFIRM_REBUILD='yes'; npm run rebuild
npm run migrate
```

`npm run rebuild` is destructive: it drops and recreates only `ecotrace_db`
without restoring deferred domain tables. `npm run migrate` then creates the
minimal username authentication schema. Normal `npm run migrate` remains the
non-destructive incremental command.

The resulting `users` table has no `org_id`, `staff_code`,
`failed_login_attempts`, or `locked_until` columns. Verify with:

```sql
USE ecotrace_db;
SHOW CREATE TABLE users;
DESCRIBE users;
```
