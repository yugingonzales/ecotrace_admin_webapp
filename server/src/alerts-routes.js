import { Router } from "express"
import { z } from "zod"
import { pool } from "./db.js"
import { authenticate, requireRoles } from "./middleware/auth.js"

const router = Router()
const input = z.object({
  event_id: z.coerce.number().int().positive().nullable().optional(),
  alert_title: z.string().trim().min(1).max(160),
  alert_body: z.string().trim().min(1).max(5000),
  alert_label: z.string().trim().min(1).max(32).optional(),
  alert_type: z.enum(["info", "success", "warning", "error"]).optional(),
  alert_status: z.enum(["draft", "published", "archived"]).optional(),
})
const fields = `a.alert_id, a.event_id, e.event_title, a.alert_title, a.alert_body, a.alert_label, a.alert_type, a.alert_status,
  DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%sZ') AS published_at, a.created_at, a.updated_at`
const fieldsWithoutEvent = `a.alert_id, NULL AS event_id, NULL AS event_title, a.alert_title, a.alert_body, a.alert_label, a.alert_type, a.alert_status,
  DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%sZ') AS published_at, a.created_at, a.updated_at`

const isSchemaMismatch = (error) => ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error?.code)
const isTransientDatabaseError = (error) => [
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "ER_CON_COUNT_ERROR",
].includes(error?.code)

async function queryWithRetry(sql, params) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await pool.query(sql, params)
    } catch (error) {
      lastError = error
      if (!isTransientDatabaseError(error) || attempt === 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  throw lastError
}

async function selectAlertRows(alertId) {
  const where = alertId === undefined ? "WHERE a.alert_status = 'published'" : "WHERE a.alert_id = ?"
  const params = alertId === undefined ? [] : [alertId]
  try {
    const [rows] = await queryWithRetry(
      `SELECT ${fields} FROM ecotrace_alerts AS a
       LEFT JOIN ecotrace_events AS e ON e.event_id = a.event_id
       ${where} ORDER BY a.published_at DESC, a.alert_id DESC`,
      params,
    )
    return rows
  } catch (error) {
    // Keep the public mobile feed usable while an older database is being migrated.
    // Event context is optional; the alert itself is not.
    if (!isSchemaMismatch(error)) throw error
    const [rows] = await queryWithRetry(
      `SELECT ${fieldsWithoutEvent} FROM ecotrace_alerts AS a ${where}
       ORDER BY a.published_at DESC, a.alert_id DESC`,
      params,
    )
    return rows
  }
}

router.get("/", async (_req, res, next) => {
  try {
    const items = await selectAlertRows()
    res.json({ items, total: items.length, page: 1, pageSize: items.length })
  } catch (error) { next(error) }
})

router.post("/", authenticate, requireRoles("admin"), async (req, res, next) => {
  try {
    const value = input.parse(req.body)
    const status = value.alert_status ?? "published"
    const [result] = await pool.execute(
      `INSERT INTO ecotrace_alerts
       (event_id, alert_title, alert_body, alert_label, alert_type, alert_status, published_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, IF(? = 'published', CURRENT_TIMESTAMP, NULL), ?)` ,
      [value.event_id ?? null, value.alert_title, value.alert_body, value.alert_label ?? "INFO", value.alert_type ?? "info", status, status, req.user.id],
    )
    const [rows] = await pool.query(`SELECT ${fields} FROM ecotrace_alerts AS a
       LEFT JOIN ecotrace_events AS e ON e.event_id = a.event_id WHERE a.alert_id = ?`, [result.insertId])
    res.status(201).json(rows[0])
  } catch (error) { next(error) }
})

export default router
