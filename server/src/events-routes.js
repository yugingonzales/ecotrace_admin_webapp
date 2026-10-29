import { Router } from "express"

import { z } from "zod"

import { pool } from "./db.js"

import { authenticate, requireRoles } from "./middleware/auth.js"
import { createPublishedAlert } from "./alert-service.js"

const router = Router()

const eventInput = z
  .object({
    event_title: z.string().trim().min(1).max(160),

    event_description: z.string().trim().max(5000).nullable().optional(),

    event_location: z.string().trim().max(255).nullable().optional(),

    event_zone: z.string().trim().max(160).nullable().optional(),

    event_boundary: z.array(
      z.tuple([
        z.coerce.number().min(-90).max(90),
        z.coerce.number().min(-180).max(180),
      ]),
    ).max(30).nullable().optional(),

    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    start_at: z.string().datetime().nullable().optional(),
    end_at: z.string().datetime().nullable().optional(),

    trees_per_student: z.coerce.number().int().min(0).max(100000),

    target_year_batch: z.string().trim().max(32).nullable().optional(),

    attendee_count: z.coerce.number().int().min(0).max(1000000).optional(),

    event_status: z
      .enum(["draft", "active", "completed", "cancelled"])
      .optional(),

    monitoring_metrics: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .superRefine((value, context) => {
    if (value.end_date < value.start_date)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date must be on or after start date.",
      })
  })

const fields = `event_id, event_title, event_description, event_location, event_zone,
  event_boundary,
  DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
  DATE_FORMAT(start_at, '%Y-%m-%dT%H:%i:%sZ') AS start_at,
  DATE_FORMAT(end_at, '%Y-%m-%dT%H:%i:%sZ') AS end_at,
  DATE_FORMAT(live_at, '%Y-%m-%dT%H:%i:%sZ') AS live_at,
  DATE_FORMAT(concluded_at, '%Y-%m-%dT%H:%i:%sZ') AS concluded_at,
  trees_per_student, target_year_batch, attendee_count, event_status,
  monitoring_metrics, created_by, created_at, updated_at`

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status

    const params = []

    let where = ""

    if (status) {
      if (!["draft", "active", "completed", "cancelled"].includes(status))
        return res
          .status(400)
          .json({ error: "invalid_request", message: "Invalid event status." })

      where = "WHERE event_status = ?"

      params.push(status)
    }

    const [items] = await pool.query(
      `SELECT ${fields} FROM ecotrace_events ${where} ORDER BY start_date ASC, event_id DESC`,
      params,
    )

    res.json({ items, total: items.length, page: 1, pageSize: items.length })
  } catch (error) {
    next(error)
  }
})

const joinedFields = `e.event_id, e.event_title, e.event_description, e.event_location, e.event_zone,
  e.event_boundary,
  DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(e.end_date, '%Y-%m-%d') AS end_date,
  e.trees_per_student, e.target_year_batch, e.attendee_count, e.event_status,
  e.monitoring_metrics,
  p.participation_status, p.joined_at,
  0 AS verified_trees`

router.get("/joined", authenticate, async (req, res, next) => {
  try {
    const [items] = await pool.query(
      `SELECT ${joinedFields}
       FROM ecotrace_event_participation AS p
       JOIN ecotrace_events AS e ON e.event_id = p.event_id
       WHERE p.user_id = ? AND p.participation_status = 'joined'
       ORDER BY e.start_date ASC, e.event_id DESC`,
      [req.user.id],
    )
    res.json({ items, total: items.length, page: 1, pageSize: items.length })
  } catch (error) { next(error) }
})

router.post(
  "/:id/join",
  authenticate,
  async (req, res, next) => {
    const eventId = Number(req.params.id)
    if (!Number.isInteger(eventId) || eventId < 1)
      return res.status(400).json({ error: "invalid_request", message: "Invalid event id." })
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [events] = await connection.query(
        `SELECT event_id, event_title, event_status FROM ecotrace_events WHERE event_id = ? FOR UPDATE`,
        [eventId],
      )
      const event = events[0]
      if (!event || !["active", "completed"].includes(event.event_status)) {
        await connection.rollback()
        return res.status(404).json({ error: "not_found", message: "Active event not found." })
      }
      const [existing] = await connection.query(
        `SELECT participation_id, participation_status, joined_at FROM ecotrace_event_participation WHERE event_id = ? AND user_id = ? FOR UPDATE`,
        [eventId, req.user.id],
      )
      if (existing[0]?.participation_status === "joined") {
        await connection.rollback()
        return res.status(200).json({ joined: true, duplicate: true, eventId, participation: existing[0] })
      }
      if (existing[0]) {
        await connection.execute(
          `UPDATE ecotrace_event_participation SET participation_status = 'joined', joined_at = CURRENT_TIMESTAMP, cancelled_at = NULL WHERE participation_id = ?`,
          [existing[0].participation_id],
        )
      } else {
        await connection.execute(
          `INSERT INTO ecotrace_event_participation (event_id, user_id) VALUES (?, ?)`,
          [eventId, req.user.id],
        )
        await connection.execute(
          `UPDATE ecotrace_events SET attendee_count = attendee_count + 1 WHERE event_id = ?`,
          [eventId],
        )
      }
      await connection.execute(
        `INSERT INTO ecotrace_alerts (event_id, alert_title, alert_body, alert_label, alert_type, alert_status, published_at, created_by)
         VALUES (?, ?, ?, 'PARTICIPATION', 'success', 'published', CURRENT_TIMESTAMP, ?)`,
        [eventId, "Participation confirmed", `You joined ${event.event_title}.`, req.user.id],
      )
      await connection.commit()
      res.status(201).json({ joined: true, duplicate: false, eventId, eventTitle: event.event_title })
    } catch (error) {
      await connection.rollback()
      next(error)
    } finally { connection.release() }
  },
)

router.delete("/:id/join", authenticate, async (req, res, next) => {
  const eventId = Number(req.params.id)
  if (!Number.isInteger(eventId) || eventId < 1)
    return res.status(400).json({ error: "invalid_request", message: "Invalid event id." })
  try {
    const [result] = await pool.execute(
      `UPDATE ecotrace_event_participation SET participation_status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE event_id = ? AND user_id = ? AND participation_status = 'joined'`,
      [eventId, req.user.id],
    )
    if (!result.affectedRows) return res.status(404).json({ error: "not_found", message: "Participation not found." })
    await pool.execute(`UPDATE ecotrace_events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE event_id = ?`, [eventId])
    res.json({ joined: false, eventId })
  } catch (error) { next(error) }
})

router.post(
  "/",
  authenticate,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const input = eventInput.parse(req.body)

      const [result] = await pool.execute(
        `INSERT INTO ecotrace_events
       (event_title, event_description, event_location, event_zone, event_boundary, start_date, end_date,
        start_at, end_at, trees_per_student, target_year_batch, attendee_count, event_status, monitoring_metrics, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

        [
          input.event_title,
          input.event_description ?? null,
          input.event_location ?? null,
          input.event_zone ?? null,
          input.event_boundary == null ? null : JSON.stringify(input.event_boundary),

          input.start_date,
          input.end_date,
          input.start_at ?? null,
          input.end_at ?? null,
          input.trees_per_student,
          input.target_year_batch ?? null,

          input.attendee_count ?? 0,
          input.event_status ?? "draft",
          JSON.stringify(input.monitoring_metrics ?? [
            "GPS Coordinates", "Status Photo", "Tree Height (cm)",
            "Growth Stage", "Diameter Measurement (cm)", "Survival Status",
          ]),
          req.user.id,
        ],
      )

      const [rows] = await pool.query(
        `SELECT ${fields} FROM ecotrace_events WHERE event_id = ?`,
        [result.insertId],
      )

      if (input.event_status === 'active') {
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          await createPublishedAlert(connection, {
            eventId: result.insertId,
            notificationCode: 'upcoming_event',
            title: `Upcoming event: ${input.event_title}`,
            body: `${input.start_date} — ${input.event_location ?? input.event_zone ?? 'target geofenced area'}. Objectives: ${(input.monitoring_metrics ?? []).join(', ') || 'tree monitoring and verification'}.`,
            label: 'UPCOMING EVENT',
            type: 'info',
            metadata: { event_id: result.insertId, start_at: input.start_at ?? null, geofenced_area: input.event_zone ?? input.event_location ?? null },
            createdBy: req.user.id,
            allUsers: true,
          })
          await connection.commit()
        } catch (error) {
          await connection.rollback().catch(() => {})
          throw error
        } finally { connection.release() }
      }

      res.status(201).json(rows[0])
    } catch (error) {
      next(error)
    }
  },
)

router.post('/:id/live', authenticate, requireRoles('admin'), async (req, res, next) => {
  await transitionEvent(req, res, next, 'live')
})

router.post('/:id/conclude', authenticate, requireRoles('admin'), async (req, res, next) => {
  await transitionEvent(req, res, next, 'conclude')
})

async function transitionEvent(req, res, next, action) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid_request', message: 'Invalid event id.' })
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [[event]] = await connection.query('SELECT event_id, event_title, event_status FROM ecotrace_events WHERE event_id = ? FOR UPDATE', [id])
    if (!event) {
      await connection.rollback()
      return res.status(404).json({ error: 'not_found', message: 'Event not found.' })
    }
    const conclude = action === 'conclude'
    await connection.execute(
      `UPDATE ecotrace_events SET event_status = ?, ${conclude ? 'concluded_at' : 'live_at'} = CURRENT_TIMESTAMP WHERE event_id = ?`,
      [conclude ? 'completed' : 'active', id],
    )
    await createPublishedAlert(connection, {
      eventId: id,
      notificationCode: conclude ? 'event_conclusion' : 'event_live',
      title: conclude ? `${event.event_title} has ended` : `${event.event_title} is live`,
      body: conclude ? 'This session is closed. Please complete your final data syncs.' : 'Geofencing and AR measurement capture are now open.',
      label: conclude ? 'EVENT ENDED' : 'EVENT LIVE',
      type: conclude ? 'info' : 'success',
      metadata: { event_id: id },
      allUsers: !conclude,
      eventParticipants: conclude,
      createdBy: req.user.id,
    })
    await connection.commit()
    res.json({ event_id: id, status: conclude ? 'completed' : 'active' })
  } catch (error) {
    await connection.rollback().catch(() => {})
    next(error)
  } finally { connection.release() }
}

router.delete(
  "/:id",
  authenticate,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: "invalid_request", message: "Invalid event id." })
      const [result] = await pool.execute("DELETE FROM ecotrace_events WHERE event_id = ?", [id])
      if (!result.affectedRows)
        return res.status(404).json({ error: "not_found", message: "Event not found." })
      res.status(204).send()
    } catch (error) { next(error) }
  },
)

router.patch(
  "/:id",
  authenticate,
  requireRoles("admin"),
  async (req, res, next) => {
    let connection
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: "invalid_request", message: "Invalid event id." })

      const input = eventInput.partial().parse(req.body)
      const entries = Object.entries(input)
      if (!entries.length)
        return res.status(400).json({ error: "invalid_request", message: "At least one field is required." })

      connection = await pool.getConnection()
      await connection.beginTransaction()

      const [beforeRows] = await connection.query(
        `SELECT event_title, start_date, end_date, event_location, event_zone,
                trees_per_student, monitoring_metrics, event_boundary
         FROM ecotrace_events WHERE event_id = ? FOR UPDATE`,
        [id],
      )
      if (!beforeRows.length) {
        await connection.rollback()
        return res.status(404).json({ error: "not_found", message: "Event not found." })
      }
      const before = beforeRows[0]

      const assignments = entries.map(([key]) => `${key} = ?`).join(", ")
      const values = entries.map(([key, value]) =>
        key === "monitoring_metrics" || key === "event_boundary"
          ? (value == null ? null : JSON.stringify(value))
          : value,
      )
      const changed = entries.some(([key, value]) => {
        const old = before[key]
        if (key === "monitoring_metrics" || key === "event_boundary")
          return JSON.stringify(value ?? null) !== JSON.stringify(old ?? null)
        return String(value ?? "") !== String(old ?? "")
      })

      if (changed) {
        await connection.execute(
          `UPDATE ecotrace_events SET ${assignments} WHERE event_id = ?`,
          [...values, id],
        )
      }

      const [rows] = await connection.query(`SELECT ${fields} FROM ecotrace_events WHERE event_id = ?`, [id])
      const updated = rows[0]
      const changes = []
      if (input.trees_per_student !== undefined && Number(input.trees_per_student) !== Number(before.trees_per_student))
        changes.push(`quota reassigned to ${input.trees_per_student} trees per staff member`)
      if (input.event_location !== undefined || input.event_zone !== undefined)
        changes.push(`target location changed to ${input.event_zone ?? input.event_location ?? "the updated location"}`)
      if (input.event_boundary !== undefined && JSON.stringify(input.event_boundary) !== JSON.stringify(before.event_boundary))
        changes.push(input.event_boundary?.length ? "geofencing boundary updated" : "geofencing boundary removed")
      if (input.monitoring_metrics !== undefined) changes.push("verification metrics updated")
      if (input.start_date !== undefined || input.end_date !== undefined)
        changes.push(`event dates updated to ${updated.start_date} through ${updated.end_date}`)
      if (input.event_title !== undefined) changes.push("event details modified")

      if (changes.length) {
        const [alertResult] = await connection.execute(
          `INSERT INTO ecotrace_alerts
             (event_id, alert_title, alert_body, alert_label, alert_type, alert_status, published_at, created_by)
           VALUES (?, ?, ?, 'EVENT UPDATE', 'info', 'published', CURRENT_TIMESTAMP, ?)`,
          [id, `${updated.event_title} was updated`, `Event update: ${changes.join("; ")}.`, req.user.id],
        )
        await connection.execute(
          `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
           SELECT ?, user_id FROM ecotrace_event_participation
           WHERE event_id = ? AND participation_status = 'joined'`,
          [alertResult.insertId, id],
        )
      }

      await connection.commit()
      res.json(updated)
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {})
      next(error)
    } finally {
      connection?.release()
    }
  },
)

export default router
