import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Login, { type SessionUser } from './components/Login'
import Overview from './components/modules/Overview'
import EventManagement from './components/modules/EventManagement'
import SubmissionsView from './components/modules/SubmissionsView'
import MapView from './components/modules/MapView'
import Analytics from './components/modules/Analytics'
import AuditLogs from './components/modules/AuditLogs'

type Module = 'overview' | 'events' | 'submissions' | 'map' | 'analytics' | 'logs'

interface Toast {
  id: number
  msg: string
  type: 'info' | 'warning' | 'error'
}

const SIDEBAR_WIDTH = 220

const SESSION_KEY = 'ecotrace_session'

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || 'AD'
  )
}

import uepLogo from './assets/uep_logo.jpg'
import collegeBg from './assets/college_of_science.jpg'

export default function App() {
  const [active, setActive] = useState<Module>('overview')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [user, setUser] = useState<SessionUser | null>(readSession)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Simulate a high-priority incident notification after signing in
  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      addToast('High-priority incident report received: Destroyed planting area (Zone B, TRE-0567) — submitted by M. Reyes', 'error')
    }, 2000)
    return () => clearTimeout(timer)
  }, [user])

  const addToast = (msg: string, type: Toast['type'] = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }

  const handleLogin = (u: SessionUser, remember: boolean) => {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setMenuOpen(false)
    setUser(null)
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `url(${collegeBg}) center/cover no-repeat fixed`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.6) 50%, rgba(47,158,110,0.3) 100%)',
            zIndex: 0,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          {/* UEP logo */}
          <div
            className="flex items-center justify-center rounded-full overflow-hidden"
            style={{ width: 110, height: 110, background: '#fff', border: '3px solid rgba(255,255,255,0.35)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          >
            <img src={uepLogo} alt="UEP Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
          </div>
          {/* Branding */}
          <div className="text-center">
            <div className="font-bold" style={{ color: '#fff', fontSize: 32, letterSpacing: 0.5 }}>EcoTrace Admin Portal</div>
          </div>
          {/* Spinner */}
          <div
            className="rounded-full"
            style={{
              width: 34,
              height: 34,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: 'var(--accent)',
              animation: 'ecotrace-spin 0.9s linear infinite',
            }}
          />
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Loading…</div>
        </div>
        <style>{`
          @keyframes ecotrace-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  const pageTitle = {
    overview: 'Overview',
    events: 'Event Management',
    submissions: 'Submissions',
    map: 'Map View',
    analytics: 'Analytics',
    logs: 'Audit Logs',
  }[active]

  const toastTone = (type: Toast['type']) =>
    type === 'error' ? 'badge-danger' : type === 'warning' ? 'badge-warning' : 'badge-accent'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar active={active} onNavigate={setActive} user={user} />

      {/* Main area */}
      <div style={{ marginLeft: SIDEBAR_WIDTH, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top header */}
        <header
          className="flex items-center justify-between px-6 py-3 sticky top-0 z-30"
          style={{ background: 'rgba(247,248,250,0.92)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>EcoTrace Admin Portal</span>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span>{pageTitle}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* System year indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs badge-accent">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
              S.Y. 2025–2026
            </div>

            {/* Notification bell */}
            <button
              className="relative p-2 rounded-md btn"
              style={{ padding: 6 }}
              onClick={() => addToast('2 new incident reports submitted in the last hour', 'warning')}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 1a5 5 0 015 5v3l1.5 2H1.5L3 9V6a5 5 0 015-5z" />
                <path d="M6.5 13a1.5 1.5 0 003 0" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
            </button>

            {/* Export shortcut */}
            <button className="btn btn-sm">Export ↓</button>

            {/* Admin avatar */}
            <div className="relative">
              <button
                className="flex items-center justify-center rounded-full text-xs font-semibold"
                style={{ width: 32, height: 32, background: 'var(--accent)', color: 'white' }}
                onClick={() => setMenuOpen(v => !v)}
                title={user.email}
              >
                {getInitials(user.name)}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-10 z-50 w-56 rounded-lg card"
                    style={{ boxShadow: '0 12px 32px rgba(16,24,40,0.14)' }}
                  >
                    <div className="px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                      <div className="font-medium" style={{ color: 'var(--text)' }}>{user.name}</div>
                      <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-xs rounded-b-lg hover:bg-gray-50"
                      style={{ color: 'var(--danger)' }}
                    >
                      Sign out →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {active === 'overview' && <Overview />}
          {active === 'events' && <EventManagement />}
          {active === 'submissions' && <SubmissionsView />}
          {active === 'map' && <MapView />}
          {active === 'analytics' && <Analytics />}
          {active === 'logs' && <AuditLogs />}
        </main>
      </div>

      {/* Toast notifications */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 380 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="flex items-start gap-3 px-4 py-3 rounded-lg text-xs"
            style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(16,24,40,0.12)', animation: 'slideIn 0.2s ease' }}
          >
            <span className={`badge ${toastTone(toast.type)}`}>
              {toast.type === 'error' ? '⚠' : toast.type === 'warning' ? '!' : 'i'}
            </span>
            <span className="flex-1 leading-snug" style={{ color: 'var(--text)' }}>{toast.msg}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
