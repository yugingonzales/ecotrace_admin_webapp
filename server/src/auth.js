import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from './config/env.js'

export function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds)
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signUserToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role_name }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  })
}

export function verifyUserToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

export function publicUser(user) {
  return {
    id: Number(user.id),
    name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
    firstName: user.first_name,
    middleName: user.middle_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role_name,
    status: user.status,
  }
}
