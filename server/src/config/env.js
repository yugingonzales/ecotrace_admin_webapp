import 'dotenv/config'

const required = ['JWT_SECRET']
for (const name of required) {
  if (!process.env[name] && process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`)
  }
}

export const env = {
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
}
