/**
 * Apply every `server/migrations/*.sql` in filename order, exactly once.
 *
 * Run:  npm run migrate        (from the server/ directory)
 *
 * WHY THIS EXISTS
 *   `package.json` pointed `npm run migrate` at this file while it did not
 *   exist, so the first command a new developer is told to run could only
 *   fail. It is also what makes the migration numbering load-bearing: files
 *   are sorted by name, so `001` must sort before `003`.
 *
 * HOW IT STAYS SAFE TO RE-RUN
 *   Applied filenames are recorded in `schema_migrations`. A file already in
 *   that table is skipped, so `npm run migrate` is idempotent and safe to
 *   run on every setup. Each file runs in its own transaction: a failing
 *   migration rolls back only itself and leaves the earlier ones applied,
 *   which is the behaviour a numbered migration log is meant to have.
 *
 * These are DDL `ALTER TABLE` statements, so note that MariaDB commits
 * implicitly around most DDL. A failure mid-file can therefore leave a
 * partially applied migration. The recorded row is only written after the
 * whole file succeeds, so a partial file is never marked as applied and will
 * be retried -- but review the table state by hand before trusting the retry.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(here, '..', 'migrations')

/** Same environment contract as src/db.js, so one .env works for both. */
const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'ecotrace_db',
  connectTimeout: 10_000,
}

function fail(message) {
  console.error(`migrate: ${message}`)
  process.exit(1)
}

/**
 * Split a .sql file into individual statements.
 *
 * These migrations contain no stored routines or BEGIN...END blocks, so a
 * semicolon at the end of a line is a real statement boundary. Splitting
 * keeps the driver from receiving a multi-statement string it would need
 * `multipleStatements: true` to accept -- deliberately left off, since
 * enabling it would widen the SQL-injection surface of the whole API.
 */
function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Files are sorted by name; the numeric prefix is the only ordering contract. */
function migrationFiles() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort()
  return files.map((name) => ({
    name,
    stem: basename(name, '.sql'),
    sql: readFileSync(resolve(migrationsDir, name), 'utf8'),
  }))
}

const migrations = migrationFiles()
if (migrations.length === 0) fail(`no .sql files found in ${migrationsDir}`)

// Refuse to run on an ambiguous ordering rather than silently picking one.
// This check exists because `002_plants_status_unverified.sql` and
// `002_seed_plants.sql` once shared a prefix, and which of the two ran first
// decided whether the seed's `unverified` rows had a valid ENUM value.
const seen = new Map()
for (const m of migrations) {
  const prefix = m.name.split('_')[0]
  if (seen.has(prefix)) {
    fail(
      `duplicate migration prefix '${prefix}': ${seen.get(prefix)} and ${m.name}. ` +
        'The runner sorts by filename, so the order between these two would be ' +
        'ambiguous. Renumber one of them.'
    )
  }
  seen.set(prefix, m.name)
}

const connection = await mysql.createConnection(CONFIG).catch((error) => {
  fail(
    `cannot connect to ${CONFIG.user}@${CONFIG.host}:${CONFIG.port}/${CONFIG.database} - ${error.message}\n` +
      '  Is MariaDB running, and are DB_HOST/DB_USER/DB_PASSWORD/DB_NAME set correctly?'
  )
})

try {
  await connection.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      'filename VARCHAR(255) NOT NULL PRIMARY KEY,' +
      'applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' +
      ') ENGINE=InnoDB'
  )
  const [rows] = await connection.query('SELECT filename FROM schema_migrations')
  const applied = new Set(rows.map((r) => r.filename))

  let count = 0
  for (const m of migrations) {
    if (applied.has(m.name)) {
      console.log(`  skip    ${m.name} (already applied)`)
      continue
    }
    const statements = splitStatements(m.sql)
    try {
      for (const statement of statements) await connection.query(statement)
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [m.name])
      console.log(`  applied ${m.name} (${statements.length} statement${statements.length === 1 ? '' : 's'})`)
      count++
    } catch (error) {
      fail(`${m.name} failed: ${error.message}\n  Not recorded as applied; fix the schema and re-run.`)
    }
  }

  console.log(count === 0 ? 'migrate: nothing to do - schema is up to date' : `migrate: ${count} migration(s) applied`)
} finally {
  await connection.end().catch(() => {})
}