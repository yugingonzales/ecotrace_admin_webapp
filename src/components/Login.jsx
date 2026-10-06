import { useState } from 'react'
import collegeBg from '../assets/college_of_science.jpg'
import uepLogo from '../assets/uep_logo.jpg'
import { ApiError, login, register, writeToken } from '../lib/api'

/** @typedef {'signin' | 'signup'} AuthMode */

/**
 * @typedef {object} SessionUser
 * @property {string} name
 * @property {string} email
 */

/**
 * @typedef {object} LoginProps
 * @property {(user: SessionUser, remember: boolean) => void} onLogin
 */

// -- Customize these to match your institution -- 
const SCHOOL_NAME = 'EcoTrace Admin Portal'
const SCHOOL_TAGLINE = ''

/** @param {unknown} error @returns {string} */
function apiErrorMessage(error) {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = /** @type {{ message?: string }} */ (error.body)
    if (body.message) return body.message
  }
  return error instanceof Error ? error.message : 'The authentication service is unavailable.'
}

/** @param {object} user @returns {SessionUser} */
function sessionUser(user) {
  const account = /** @type {{ name?: string, firstName?: string, lastName?: string, email: string }} */ (user)
  return {
    name: account.name || [account.firstName, account.lastName].filter(Boolean).join(' ') || account.email,
    email: account.email,
  }
}

/** @param {LoginProps} props */
export default function Login({ onLogin }) {
  const [mode, setMode] = useState(/** @type {AuthMode} */ ('signin'))
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  /** @param {AuthMode} next */
  const switchMode = next => {
    setMode(next)
    setErrors({})
    setNotice('')
    setPassword('')
    setConfirm('')
  }

  /** @returns {boolean} */
  const validateSignIn = () => {
    /** @type {Record<string, string>} */
    const next = {}
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** @returns {boolean} */
  const validateSignUp = () => {
    /** @type {Record<string, string>} */
    const next = {}
    if (!firstName.trim()) next.firstName = 'First name is required.'
    if (!lastName.trim()) next.lastName = 'Last name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.'
    if (password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** @param {import('react').FormEvent<HTMLFormElement>} e */
  const handleSubmit = async e => {
    e.preventDefault()
    setNotice('')
    setErrors({})

    if (mode === 'signin' && !validateSignIn()) return
    if (mode === 'signup' && !validateSignUp()) return

    setLoading(true)
    try {
      if (mode === 'signin') {
        const data = await login(email.trim(), password)
        if (data.user?.role_name !== 'admin' && data.user?.role !== 'admin') {
          writeToken(null)
          setErrors({ form: 'Access denied: Administrative privileges required.' })
          return
        }
        writeToken(data.token, remember)
        onLogin(sessionUser(data.user), remember)
      } else {
        await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, phone: '' })
        writeToken(null)
        setNotice('Account created successfully. Public accounts are not permitted to access the admin portal.')
        setMode('signin')
        setPassword('')
        setConfirm('')
      }
    } catch (error) {
      setErrors({ form: apiErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  /** @param {string} field */
  const errorMark = field =>
    (errors[field] && (
      <p className="mt-1" style={{ color: 'var(--danger)', fontSize: 11 }}>{errors[field]}</p>
    )) || null
return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `url(${collegeBg}) center/cover no-repeat fixed`,
      padding: 24,
      position: 'relative',
      overflow: 'auto',
    }}>
      {/* Dark overlay for readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.55) 50%, rgba(47,158,110,0.25) 100%)',
        zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div className="card w-full" style={{ maxWidth: 420, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        {/* Brand header */}
        <div className="card-header flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0" style={{ width: 40, height: 40, background: '#fff', border: '1px solid var(--border)' }}>
            <img src={uepLogo} alt="UEP Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
          </div>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>{SCHOOL_NAME}</div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{SCHOOL_TAGLINE}</div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '22px 24px 18px' }}>
          {/* Segmented control */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg mb-6" style={{ background: 'var(--surface-muted)' }}>
            {/** @type {AuthMode[]} */ (['signin', 'signup']).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="py-2 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? 'var(--accent-dark)' : 'var(--text-muted)',
                  boxShadow: mode === m ? '0 1px 3px rgba(16,24,40,0.12)' : 'none',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <h2 className="font-semibold" style={{ fontSize: 18, color: 'var(--text)' }}>
            {mode === 'signin' ? 'Welcome back' : 'Register an administrator'}
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {mode === 'signin'
              ? 'Sign in to access the administrative dashboard.'
              : 'Create an administrative account for dashboard access.'}
          </p>

          {errors.form && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded text-xs" style={{ background: 'var(--danger-soft)', border: '1px solid rgba(220,58,58,0.3)', color: 'var(--danger)' }}>
              <span>⚠</span>
              <span>{errors.form}</span>
            </div>
          )}
<form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="login-first-name" className="field-label">First name</label>
                  <input
                    id="login-first-name"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Juan"
                    className="input"
                    style={{ borderColor: errors.firstName ? 'var(--danger)' : undefined }}
                  />
                  {errorMark('firstName')}
                </div>
                <div>
                  <label htmlFor="login-last-name" className="field-label">Last name</label>
                  <input
                    id="login-last-name"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Dela Cruz"
                    className="input"
                    style={{ borderColor: errors.lastName ? 'var(--danger)' : undefined }}
                  />
                  {errorMark('lastName')}
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="login-middle-name" className="field-label">
                  Middle name <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="login-middle-name"
                  type="text"
                  value={middleName}
                  onChange={e => setMiddleName(e.target.value)}
                  placeholder="A."
                  className="input"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="field-label">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@school.edu"
                autoComplete="username"
                className="input"
                style={{ borderColor: errors.email ? 'var(--danger)' : undefined }}
              />
              {errorMark('email')}
            </div>

            <div>
              <label htmlFor="login-password" className="field-label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="input"
                  style={{ borderColor: errors.password ? 'var(--danger)' : undefined, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-0 h-full px-3 flex items-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 1l22 22" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errorMark('password')}
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="login-confirm" className="field-label">Confirm password</label>
                <input
                  id="login-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="input"
                  style={{ borderColor: errors.confirm ? 'var(--danger)' : undefined }}
                />
                {errorMark('confirm')}
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex items-center justify-between">
                <label htmlFor="keep-signed-in" className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
                  <input
                    id="keep-signed-in"
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 13, height: 13 }}
                  />
                  Keep me signed in
                </label>
                <button
                  type="button"
                  onClick={() => setNotice('Password resets are handled by the system administrator. Please contact the IT office.')}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--accent-dark)', fontWeight: 500 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center text-sm"
              style={{ height: 38 }}
            >
              {loading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {mode === 'signin' ? 'Signing in' : 'Creating account'}
                </>
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {notice && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded text-xs" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(47,158,110,0.25)', color: 'var(--accent-dark)' }}>
              <span></span>
              <span>{notice}</span>
            </div>
          )}
        </div>

        <p className="text-center pb-4 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Protected area · Authorized school personnel only
        </p>
      </div>
      </div>
    </div>
  )
}
