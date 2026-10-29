import { Router } from 'express'
import { z } from 'zod'
import { pool } from './db.js'
import { authenticate, requireRoles } from './middleware/auth.js'
import { assertStatusTransition, reviewAction } from './submission-workflow.js'
import { createPublishedAlert } from './alert-service.js'

const reviewSchema = z.object({
  status: z.enum(['approved', 'declined', 'resubmit']),
  reason: z.string().trim().max(160).optional().default(''),
  note: z.string().trim().max(2000).optional().default(''),
})
const listSchema = z.object({
  status: z.enum(['pending', 'approved', 'declined', 'resubmit']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

const submissionFields = `s.submission_id, s.tree_id, s.event_id, s.submitted_by,
  s.submission_type, s.submission_status, s.submitted_at, s.reviewed_by,
  s.reviewed_at, s.decline_reason, s.reviewer_note,
  p.tree_code, p.tree_name, p.tree_status,
  u.first_name AS submitter_first_name, u.last_name AS submitter_last_name,
  e.event_title`

export function createSubmissionsRouter({
  submissionPool = pool,
  authenticateMiddleware = authenticate,
  requireRolesMiddleware = requireRoles,
} = {}) {
  const router = Router()
  const roles = (...names) => requireRolesMiddleware(...names)

  router.use(authenticateMiddleware)

  router.get('/mine', async (req, res, next) => {
    try {
      const [items] = await submissionPool.query(
        `SELECT ${submissionFields}
         FROM ecotrace_submissions AS s
         JOIN ecotrace_plants AS p ON p.tree_id = s.tree_id
         LEFT JOIN users AS u ON u.id = s.submitted_by
         LEFT JOIN ecotrace_events AS e ON e.event_id = s.event_id
         WHERE s.submitted_by = ?
         ORDER BY s.submitted_at DESC, s.submission_id DESC`,
        [req.user.id],
      )
      res.json({ items, total: items.length })
    } catch (error) { next(error) }
  })

  router.get('/', roles('admin', 'staff'), async (req, res, next) => {
  try {
    const { status, page, pageSize } = listSchema.parse(req.query)
    const offset = (page - 1) * pageSize
    const where = status ? 'WHERE s.submission_status = ?' : ''
    const params = status ? [status] : []
    const [[count]] = await submissionPool.query(
      `SELECT COUNT(*) AS total FROM ecotrace_submissions AS s ${where}`,
      params,
    )
    const [items] = await submissionPool.query(
      `SELECT ${submissionFields}
       FROM ecotrace_submissions AS s
       JOIN ecotrace_plants AS p ON p.tree_id = s.tree_id
       JOIN users AS u ON u.id = s.submitted_by
       LEFT JOIN ecotrace_events AS e ON e.event_id = s.event_id
       ${where} ORDER BY s.submitted_at DESC, s.submission_id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )
    res.json({ items, total: Number(count.total), page, pageSize })
  } catch (error) { next(error) }
})

  router.patch('/:id/review', roles('admin', 'staff'), async (req, res, next) => {
  const submissionId = Number(req.params.id)
  if (!Number.isSafeInteger(submissionId) || submissionId < 1)
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid submission id.' })
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success)
    return res.status(400).json({ error: 'invalid_request', message: 'Please check the review fields.', details: parsed.error.issues })

  let details
  try { details = reviewAction(parsed.data.status, parsed.data.reason, parsed.data.note) }
  catch (error) { return res.status(error.status ?? 400).json({ error: error.code ?? 'invalid_request', message: error.message }) }

  const connection = await submissionPool.getConnection()
  try {
    await connection.beginTransaction()
    const [[submission]] = await connection.query(
      'SELECT submission_id, tree_id, submitted_by, submission_type, submission_status FROM ecotrace_submissions WHERE submission_id = ? FOR UPDATE',
      [submissionId],
    )
    if (!submission) {
      const error = new Error('Submission was not found.')
      error.status = 404
      error.code = 'not_found'
      throw error
    }
    assertStatusTransition(submission.submission_status, parsed.data.status)

    await connection.query(
      `UPDATE ecotrace_submissions
       SET submission_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           decline_reason = ?, reviewer_note = ?
       WHERE submission_id = ?`,
      [parsed.data.status, req.user.id, details.declineReason, details.reviewerNote, submissionId],
    )
    if (parsed.data.status === 'approved') {
      await connection.query("UPDATE ecotrace_plants SET tree_status = 'verified' WHERE tree_id = ?", [submission.tree_id])
    }
    await createPublishedAlert(connection, {
      notificationCode: 'verification_update',
      title: `Verification ${parsed.data.status}`,
      body: parsed.data.status === 'approved'
        ? 'Your tree verification record was approved.'
        : parsed.data.status === 'resubmit'
          ? `Your record needs changes${details.reviewerNote ? `: ${details.reviewerNote}` : '.'}`
          : `Your record was declined${details.declineReason ? `: ${details.declineReason}` : '.'}`,
      label: 'VERIFICATION UPDATE',
      type: parsed.data.status === 'approved' ? 'success' : parsed.data.status === 'declined' ? 'error' : 'warning',
      metadata: { submission_id: submissionId, status: parsed.data.status },
      userIds: [submission.submitted_by],
    })

    await connection.query(
      `INSERT INTO ecotrace_audit_logs
       (actor_user_id, action_code, entity_type, entity_id, details)
       VALUES (?, ?, 'submission', ?, ?)`,
      [req.user.id, `SUBMISSION_${parsed.data.status.toUpperCase()}`, submissionId, JSON.stringify({ from: submission.submission_status, to: parsed.data.status, reason: details.declineReason, note: details.reviewerNote })],
    )
    await connection.commit()
    res.json({ submission_id: submissionId, status: parsed.data.status })
  } catch (error) {
    await connection.rollback().catch(() => {})
    next(error)
  } finally { connection.release() }
  })

  return router
}

const router = createSubmissionsRouter()

export default router
