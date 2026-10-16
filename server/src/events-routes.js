import { Router } from "express"

import { z } from "zod"

import { pool } from "./db.js"

import { authenticate, requireRoles } from "./middleware/auth.js"

const router = Router()

const eventInput = z
  .object({
    event_title: z.string().trim().min(1).max(160),

    event_description: z.string().trim().max(5000).nullable().optional(),

    event_location: z.string().trim().max(255).nullable().optional(),

    event_zone: z.string().trim().max(160).nullable().optional(),

    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    trees_per_student: z.coerce.number().int().min(0).max(100000),

    target_year_batch: z.string().trim().max(32).nullable().optional(),

    attendee_count: z.coerce.number().int().min(0).max(1000000).optional(),

    event_status: z
      .enum(["draft", "active", "completed", "cancelled"])
      .optional(),
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
  DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
  trees_per_student, target_year_batch, attendee_count, event_status, created_by,
  created_at, updated_at`

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
  DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(e.end_date, '%Y-%m-%d') AS end_date,
  e.trees_per_student, e.target_year_batch, e.attendee_count, e.event_status,
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
       (event_title, event_description, event_location, event_zone, start_date, end_date,
        trees_per_student, target_year_batch, attendee_count, event_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

        [
          input.event_title,
          input.event_description ?? null,
          input.event_location ?? null,
          input.event_zone ?? null,

          input.start_date,
          input.end_date,
          input.trees_per_student,
          input.target_year_batch ?? null,

          input.attendee_count ?? 0,
          input.event_status ?? "draft",
          req.user.id,
        ],
      )

      const [rows] = await pool.query(
        `SELECT ${fields} FROM ecotrace_events WHERE event_id = ?`,
        [result.insertId],
      )

      res.status(201).json(rows[0])
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  "/:id",
  authenticate,
  requireRoles("admin"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id)

      if (!Number.isInteger(id) || id < 1)
        return res
          .status(400)
          .json({ error: "invalid_request", message: "Invalid event id." })

      const input = eventInput.partial().parse(req.body)

      const entries = Object.entries(input)

      if (!entries.length) return res.status(400).json({
          error: "invalid_request",
          message: "At least one field is required.",
        })

      const assignments = entries.map(([key]) => `${key} = ?`).join(", ")

      const [result] = await pool.execute(
        `UPDATE ecotrace_events SET ${assignments} WHERE event_id = ?`,
        [...entries.map(([, value]) => value), id],
      )

      if (!result.affectedRows)
        return res
          .status(404)
          .json({ error: "not_found", message: "Event not found." })

      const [rows] = await pool.query(
        `SELECT ${fields} FROM ecotrace_events WHERE event_id = ?`,
        [id],
      )

      res.json(rows[0])
    } catch (error) {
      next(error)
    }
  },
)

export default router
