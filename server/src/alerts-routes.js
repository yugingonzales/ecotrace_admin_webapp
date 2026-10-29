import { Router } from "express"

import { z } from "zod"

import { pool } from "./db.js"

import { authenticate, requireRoles } from "./middleware/auth.js"
import { createPublishedAlert } from "./alert-service.js"

const router = Router()

const input = z.object({
  event_id: z.coerce.number().int().positive().nullable().optional(),
  notification_code: z.string().trim().max(48).optional(),
  metadata: z.record(z.any()).optional(),

  alert_title: z.string().trim().min(1).max(160),

  alert_body: z.string().trim().min(1).max(5000),

  alert_label: z.string().trim().min(1).max(32).optional(),

  alert_type: z.enum(["info", "success", "warning", "error"]).optional(),

  alert_status: z.enum(["draft", "published", "archived"]).optional(),
})

const fields = `a.alert_id, a.event_id, e.event_title, a.notification_code, a.metadata, a.alert_title, a.alert_body, a.alert_label, a.alert_type, a.alert_status,
  DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%sZ') AS published_at, a.created_at, a.updated_at`

const fieldsWithoutEvent = `a.alert_id, NULL AS event_id, NULL AS event_title, a.notification_code, a.metadata, a.alert_title, a.alert_body, a.alert_label, a.alert_type, a.alert_status,
  DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%sZ') AS published_at, a.created_at, a.updated_at`

const isSchemaMismatch = (error) =>
  ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error?.code)

const isTransientDatabaseError = (error) =>
  [
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
  const where =
    alertId === undefined
      ? "WHERE a.alert_status = 'published'"
      : "WHERE a.alert_id = ?"

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

router.get("/", authenticate, async (req, res, next) => {
  try {
    let items

    try {
      // Start with published alerts so older alerts remain visible even when

      // they were created before per-user recipient rows were introduced.

      const [rows] = await pool.query(
        `SELECT ${fields}, COALESCE(ar.read_at IS NOT NULL, 0) AS \`read\`
         FROM ecotrace_alerts AS a
         LEFT JOIN ecotrace_alert_recipients AS ar
           ON ar.alert_id = a.alert_id AND ar.user_id = ?
         LEFT JOIN ecotrace_events AS e ON e.event_id = a.event_id
         WHERE a.alert_status = 'published'
           AND (
             ar.user_id IS NOT NULL
             OR NOT EXISTS (
               SELECT 1 FROM ecotrace_alert_recipients AS legacy_ar
               WHERE legacy_ar.alert_id = a.alert_id
             )
           )
         ORDER BY a.published_at DESC, a.alert_id DESC`,

        [req.user.id],
      )

      items = rows
    } catch (error) {
      // Keep the mobile feed usable while migration 014 is unavailable or the

      // recipient table is temporarily unhealthy. Read state is unavailable,

      // but published alerts can still be safely displayed.

      if (!isSchemaMismatch(error)) throw error

      items = await selectAlertRows()

      items = items.map((item) => ({ ...item, read: 0 }))
    }

    res.json({ items, total: items.length, page: 1, pageSize: items.length })
  } catch (error) {
    next(error)
  }
})

const markAlertRead = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id < 1)
      return res
        .status(400)
        .json({ error: "invalid_request", message: "Invalid alert id." })

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [alerts] = await connection.query(
        `SELECT a.alert_id
         FROM ecotrace_alerts AS a
         WHERE a.alert_id = ? AND a.alert_status = 'published'
           AND (
             EXISTS (
               SELECT 1 FROM ecotrace_alert_recipients AS own_ar
               WHERE own_ar.alert_id = a.alert_id AND own_ar.user_id = ?
             )
             OR NOT EXISTS (
               SELECT 1 FROM ecotrace_alert_recipients AS any_ar
               WHERE any_ar.alert_id = a.alert_id
             )
           )`,
        [id, req.user.id],
      )
      if (!alerts.length) {
        await connection.rollback()
        return res.status(404).json({ error: "not_found", message: "Alert not found." })
      }
      const [recipientRows] = await connection.query(
        `SELECT recipient_id FROM ecotrace_alert_recipients WHERE alert_id = ? LIMIT 1`,
        [id],
      )
      if (!recipientRows.length) {
        // Legacy published alerts were global and have no recipient rows.
        // Seed all active mobile users before storing one user's read state.
        await connection.execute(
          `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
           SELECT ?, u.id
           FROM users AS u
           JOIN roles AS r ON r.id = u.role_id
           WHERE u.status = 'active' AND r.name <> 'admin'`,
          [id],
        )
      } else {
        await connection.execute(
          `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
           VALUES (?, ?)`,
          [id, req.user.id],
        )
      }
      await connection.execute(
        `UPDATE ecotrace_alert_recipients
         SET read_at = CURRENT_TIMESTAMP
         WHERE alert_id = ? AND user_id = ?`,
        [id, req.user.id],
      )
      await connection.commit()
      res.status(204).send()
    } catch (error) {
      await connection.rollback().catch(() => {})
      next(error)
    } finally {
      connection.release()
    }
  } catch (error) {
    next(error)
  }
}

router.patch("/:id/read", authenticate, markAlertRead)
router.post("/:id/read", authenticate, markAlertRead)

router.post(
  "/",
  authenticate,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const value = input.parse(req.body)

      const status = value.alert_status ?? "published"

      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [result] = await connection.execute(
          `INSERT INTO ecotrace_alerts
       (event_id, notification_code, alert_title, alert_body, metadata, alert_label, alert_type, alert_status, published_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'published', CURRENT_TIMESTAMP, NULL), ?)`,

          [
            value.event_id ?? null,
            value.notification_code ?? "platform_announcement",
            value.alert_title,
            value.alert_body,
            value.metadata == null ? null : JSON.stringify(value.metadata),
            value.alert_label ?? "INFO",
            value.alert_type ?? "info",
            status,
            status,
            req.user.id,
          ],
        )

        if (status === "published") {
          // Admin announcements target active mobile users. The current users
          // schema does not store a year batch, so event targeting cannot be
          // narrowed further until that identity field is added.
          await connection.execute(
            `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
             SELECT ?, u.id
             FROM users AS u
             JOIN roles AS r ON r.id = u.role_id
             WHERE u.status = 'active' AND r.name <> 'admin'`,
            [result.insertId],
          )
        }

        await connection.commit()

        const [rows] = await pool.query(
          `SELECT ${fields} FROM ecotrace_alerts AS a
       LEFT JOIN ecotrace_events AS e ON e.event_id = a.event_id WHERE a.alert_id = ?`,
          [result.insertId],
        )

        res.status(201).json(rows[0])
      } catch (error) {
        await connection.rollback().catch(() => {})

        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      next(error)
    }
  },
)

export default router
