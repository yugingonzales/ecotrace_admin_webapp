import { pool } from '../db.js'
import { verifyUserToken } from '../auth.js'

export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'A bearer token is required.' })

  try {
    const claims = verifyUserToken(token)
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role_name
       FROM users AS u JOIN roles AS r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [claims.sub],
    )
    const user = rows[0]
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'unauthorized', message: 'This account is inactive or unavailable.' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'The token is invalid or expired.' })
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have permission for this action.' })
    }
    next()
  }
}
