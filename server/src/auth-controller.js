import { z } from 'zod'
import { pool } from './db.js'
import { hashPassword, verifyPassword, signUserToken, publicUser } from './auth.js'

const loginCredentials = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(8).max(128) })
const registration = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().or(z.literal('')),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
})

function invalid(res, result) {
  return res.status(400).json({ error: 'invalid_request', message: 'Please check the submitted fields.', details: result.error.issues })
}

async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.*, r.name AS role_name
     FROM users AS u JOIN roles AS r ON r.id = u.role_id
     WHERE u.email = ? LIMIT 1`,
    [email.toLowerCase()],
  )
  return rows[0]
}

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.*, r.name AS role_name
     FROM users AS u JOIN roles AS r ON r.id = u.role_id
     WHERE u.username = ? LIMIT 1`,
    [username.trim()],
  )
  return rows[0]
}

export async function register(req, res, next) {
  const parsed = registration.safeParse(req.body)
  if (!parsed.success) return invalid(res, parsed)
  const data = parsed.data
  try {
    const existing = await findByEmail(data.email)
    if (existing) return res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' })
    const existingUsername = await findByUsername(data.username)
    if (existingUsername) return res.status(409).json({ error: 'username_exists', message: 'An account with this username already exists.' })
    const [[role]] = await pool.query('SELECT id FROM roles WHERE name = \'volunteer\'')
    if (!role) return res.status(500).json({ error: 'configuration_error', message: 'The volunteer role is not configured.' })
    await pool.query(
      `INSERT INTO users (role_id, username, first_name, middle_name, last_name, email, password_hash, phone)
       VALUES (?, ?, ?, NULLIF(?, ''), ?, ?, ?, NULLIF(?, ''))`,
      [role.id, data.username, data.firstName, data.middleName ?? '', data.lastName, data.email.toLowerCase(), await hashPassword(data.password), data.phone ?? ''],
    )
    const user = await findByEmail(data.email)
    res.status(201).json({ token: signUserToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
}

export async function login(req, res, next) {
  const parsed = loginCredentials.safeParse(req.body)
  if (!parsed.success) return invalid(res, parsed)
  try {
    const user = await findByUsername(parsed.data.username)
    if (!user) {
      return res.status(401).json({ error: 'account_not_found', message: 'No account was found for this username.' })
    }
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'account_unavailable', message: 'This account is unavailable. Please contact an administrator.' })
    }
    if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'incorrect_password', message: 'The password is incorrect.' })
    }
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id])
    res.json({ token: signUserToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
}

export function profile(req, res) { res.json({ user: publicUser(req.user) }) }
