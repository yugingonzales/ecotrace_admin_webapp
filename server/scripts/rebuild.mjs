/**
 * Rebuild ecotrace_db from the checked-in baseline.
 *
 * DESTRUCTIVE: this drops and recreates DB_NAME. Make a backup first.
 * Run from server/: npm run rebuild
 *
 * The fresh database is intentionally empty. Authentication is then created by
 * migration 007, so deferred domain tables are not restored accidentally.
 */
import 'dotenv/config'
import mysql from 'mysql2/promise'

const database = process.env.DB_NAME ?? 'ecotrace_db'
const config = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  connectTimeout: 10_000,
}
if (process.env.CONFIRM_REBUILD !== 'yes') {
  throw new Error('Refusing to drop the database. Set CONFIRM_REBUILD=yes to run this destructive command.')
}

const connection = await mysql.createConnection(config)
try {
  await connection.query(`DROP DATABASE IF EXISTS \`${database.replace(/`/g, '``')}\``)
  await connection.query(`CREATE DATABASE \`${database.replace(/`/g, '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
} finally {
  await connection.end()
}

console.log(`Rebuilt ${database}. Run "npm run migrate" to create the minimal authentication schema.`)
