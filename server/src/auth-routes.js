import { Router } from 'express'
import { login, profile, register } from './auth-controller.js'
import { authenticate } from './middleware/auth.js'

const router = Router()
router.post('/register', register)
router.post('/login', login)
router.get('/profile', authenticate, profile)
router.get('/me', authenticate, profile)
export default router
