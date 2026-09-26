/**
 * MariaDB connection pool.
 *
 * The target is XAMPP's bundled MariaDB 10.4.32 (datadir C:\xampp\mysql\data),
 * NOT the Laragon MySQL 8.4.3 instance. See INTEGRATION_PROGRESS_LOG.md - the
 * earlier entry naming Laragon was wrong and cost real debugging time.
 *
 * Credentials default to XAMPP's stock root-with-no-password setup. Every value
 * is overridable by environment variable so nothing is hard-coded, but note
 * these are read by the Node process, never bundled into the browser: no
 * VITE_ prefix, per the rule in .env.example.
 */
import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'ecotrace_db',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  // DECIMAL columns come back as strings by default to avoid precision loss.
  // Lat/lng are bounded to 8 decimal places by the column definitions, so
  // parsing to float here is lossless and saves every consumer from doing it.
  decimalNumbers: true,
  // Reject a dead connection instead of hanging the request.
  connectTimeout: 10_000,
})

/** Liveness probe used by GET /api/health. Never throws. */
export async function ping() {
  const started = Date.now()
  try {
    const [rows] = await pool.query('SELECT 1 AS ok')
    return { ok: rows?.[0]?.ok === 1, latencyMs: Date.now() - started }
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error.message }
  }
}

export async function closePool() {
  await pool.end()
}
