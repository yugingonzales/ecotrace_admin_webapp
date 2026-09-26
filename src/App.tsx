import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Sidebar from './components/Sidebar'
import Login, { type SessionUser } from './components/Login'
import ToastViewport from './components/ToastViewport'
import Overview from './components/modules/Overview'
import EventManagement from './components/modules/EventManagement'
import SubmissionsView from './components/modules/SubmissionsView'
import MapView from './components/modules/MapView'
import Analytics from './components/modules/Analytics'
import AuditLogs from './components/modules/AuditLogs'
import {
  LEGACY_NOTIFICATION_TARGET,
  MODULE_TITLES,
  usePortal,
  type NotifType,
  type NotificationTarget,
} from './lib/store'
import { useEscapeToClose } from './lib/useEscapeToClose'
import { useOutsideClick } from './lib/useOutsideClick'
import { downloadCsv } from './lib/csv'

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

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const notifTone = (type: NotifType) =>
  type === 'error' ? 'badge-danger' : type === 'warning' ? 'badge-warning' : 'badge-accent'

const notifGlyph = (type: NotifType) => (type === 'error' ? '⚠' : type === 'warning' ? '!' : 'i')

/** Where a row will take you, for the row's tooltip and accessible name. */
const targetLabel = (t: NotificationTarget): string =>
  t.module === 'submissions' ? 'Open in Submissions' : `Go to ${MODULE_TITLES[t.module]}`

/**
 * A module pane that stays mounted after its first visit.
 *
 * Tabs are switched by hiding panes, not by unmounting them, so filter state,
 * scroll position and half-typed filters survive a tab round trip. Leaflet maps
 * are the exception that needs a nudge on re-show — see `MapAutoResize`.
 */
function ModulePane({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div style={{ display: show ? undefined : 'none' }} aria-hidden={!show} inert={!show}>
      {children}
    </div>
  )
}

export default function App() {
  const { active, visited, navigate, notifications, unreadCount, pendingCount, submissions, attention, storeActions } = usePortal()
  const [notifOpen, setNotifOpen] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(readSession)
  const [menuOpen, setMenuOpen] = useState(false)

  // Refs for the two header popovers. The trigger refs are handed to the
  // outside-click hook alongside the panel refs, so clicking the bell to close
  // the panel is not immediately undone by the hook dismissing it first.
  const notifBtnRef = useRef<HTMLButtonElement>(null)
  const notifPanelRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

  // Audit rows are attributed to whoever is signed in. Session-scoped, so it is
  // deliberately not persisted with the rest of the store.
  useEffect(() => {
    storeActions.setActor(user ? { name: user.name, email: user.email } : null)
  }, [user, storeActions])

  useEffect(() => {
    document.title = user ? `${MODULE_TITLES[active]} · EcoTrace Admin` : 'Sign in · EcoTrace Admin'
  }, [active, user])

  const closeNotif = useCallback(() => setNotifOpen(false), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useEscapeToClose(closeNotif, notifOpen)
  useEscapeToClose(closeMenu, menuOpen)
  useOutsideClick([notifPanelRef, notifBtnRef], closeNotif, notifOpen)
  useOutsideClick([menuPanelRef, menuBtnRef], closeMenu, menuOpen)

  // Only one header popover at a time. They are anchored to the same corner and
  // would otherwise sit on top of each other.
  const toggleNotif = () => {
    setMenuOpen(false)
    setNotifOpen(v => !v)
  }
  const toggleMenu = () => {
    setNotifOpen(false)
    setMenuOpen(v => !v)
  }

  const handleLogin = (u: SessionUser, remember: boolean) => {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setMenuOpen(false)
    setNotifOpen(false)
    setUser(null)
  }

  /** Header shortcut: the submissions register, the portal's primary dataset. */
  const handleExport = () => {
    const rows = submissions.map(s => [
      s.id, s.staffName, s.staffId, s.staffType, s.treeTag, s.species,
      s.type, s.status, s.event, s.date, s.lat, s.lng,
      s.incidentType ?? '', s.declineReason ?? '', s.notes ?? '',
    ])
    const n = downloadCsv(
      'ecotrace_submissions_register.csv',
      ['Submission ID', 'Staff', 'Staff ID', 'Staff Type', 'Tree Tag', 'Species', 'Type', 'Status',
        'Event', 'Submitted', 'Latitude', 'Longitude', 'Incident Type', 'Decline Reason', 'Notes'],
      rows,
    )
    storeActions.recordExport(`Exported the submissions register (CSV) — ${n.toLocaleString()} records`, n)
  }

  const handleReset = () => {
    storeActions.resetDemoData()
    setMenuOpen(false)
  }

  /**
   * Follow a notification's destination and dismiss the panel.
   *
   * Closing matters as much as navigating: the popover is anchored to the header
   * and would otherwise sit on top of whatever page the link just opened. The
   * module is split off explicitly rather than spread into `navigate`, so a
   * target field that the destination does not consume can never leak through as
   * an instruction it will silently ignore.
   */
  const goTo = (target: NotificationTarget) => {
    if (target.module === 'submissions') {
      navigate('submissions', { status: target.status, type: target.type, treeTag: target.treeTag, event: target.event })
    } else {
      navigate(target.module)
    }
    closeNotif()
  }

  if (!user) return <Login onLogin={handleLogin} />

  const pageTitle = MODULE_TITLES[active]
  const sortedNotifications = [...notifications].sort((a, b) => b.time - a.time)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar active={active} onNavigate={m => navigate(m)} user={user} pendingCount={pendingCount} />

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
            <div className="relative">
              <button
                ref={notifBtnRef}
                className="relative p-2 rounded-md btn"
                style={{ padding: 6 }}
                onClick={toggleNotif}
                title="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1a5 5 0 015 5v3l1.5 2H1.5L3 9V6a5 5 0 015-5z" />
                  <path d="M6.5 13a1.5 1.5 0 003 0" />
                </svg>
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ minWidth: 16, height: 16, padding: '0 4px', background: 'var(--danger)' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>


              {notifOpen && (
                <div
                  ref={notifPanelRef}
                  className="absolute right-0 top-10 z-50 w-80 rounded-lg card"
                  style={{ boxShadow: '0 12px 32px rgba(16,24,40,0.14)' }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      Notifications
                      {unreadCount > 0 && <span className="ml-1.5 badge badge-danger">{unreadCount} new</span>}
                    </div>
                    <button
                      className="text-xs font-medium disabled:opacity-50"
                      style={{ color: 'var(--accent-dark)' }}
                      onClick={() => storeActions.markAllRead()}
                      disabled={unreadCount === 0}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {attention.length > 0 && (
                      <section aria-label="Needs attention">
                        <div
                          className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Needs attention
                        </div>
                        {attention.map(item => (
                          <button
                            key={item.key}
                            onClick={() => goTo(item.target)}
                            title={targetLabel(item.target)}
                            className="w-full text-left flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 focus-visible:bg-gray-50"
                            style={{ borderBottom: '1px solid var(--border)' }}
                          >
                            <span className={`badge mt-0.5 ${notifTone(item.type)}`}>{notifGlyph(item.type)}</span>
                            <span className="flex-1 min-w-0 text-xs leading-snug" style={{ color: 'var(--text)' }}>
                              {item.msg}
                            </span>
                            <span className="mt-1 shrink-0 text-sm leading-none" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
                              ›
                            </span>
                          </button>
                        ))}
                      </section>
                    )}
                    {/* Kept outside the region above: an "Activity" heading nested in
                        a "Needs attention" landmark is announced as part of it. */}
                    {attention.length > 0 && sortedNotifications.length > 0 && (
                      <div
                        className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Activity
                      </div>
                    )}
                    {sortedNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
                        No notifications yet
                      </div>
                    ) : (
                      sortedNotifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => {
                            storeActions.markRead(n.id)
                            goTo(n.target ?? LEGACY_NOTIFICATION_TARGET)
                          }}
                          title={targetLabel(n.target ?? LEGACY_NOTIFICATION_TARGET)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 focus-visible:bg-gray-50"
                          style={{
                            background: n.read ? '#fff' : 'var(--accent-soft)',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <span className={`badge mt-0.5 ${notifTone(n.type)}`}>{notifGlyph(n.type)}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs leading-snug" style={{ color: 'var(--text)' }}>
                              {n.msg}
                            </span>
                            <span className="block mt-0.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                              {timeAgo(n.time)}
                            </span>
                          </span>
                          {!n.read && (
                            <span
                              className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                              style={{ background: 'var(--accent)' }}
                            />
                          )}
                          {/* The affordance that makes the row read as a link rather
                              than as static text. Decorative — the row's accessible
                              name carries the destination. */}
                          <span className="mt-1 shrink-0 text-sm leading-none" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
                            ›
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Export shortcut — the submissions register */}
            <button className="btn btn-sm" onClick={handleExport} title="Download the submissions register as CSV">
              Export ↓
            </button>

            {/* Admin avatar */}
            <div className="relative">
              <button
                ref={menuBtnRef}
                className="flex items-center justify-center rounded-full text-xs font-semibold"
                style={{ width: 32, height: 32, background: 'var(--accent)', color: 'white' }}
                onClick={toggleMenu}
                title={user.email}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {getInitials(user.name)}
              </button>
              {menuOpen && (
                <div
                  ref={menuPanelRef}
                  className="absolute right-0 top-10 z-50 w-64 rounded-lg card"
                  style={{ boxShadow: '0 12px 32px rgba(16,24,40,0.14)' }}
                  role="menu"
                >
                  <div className="px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-medium" style={{ color: 'var(--text)' }}>{user.name}</div>
                    <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50"
                    style={{ color: 'var(--text-muted)' }}
                    role="menuitem"
                  >
                    Reset demo data
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-xs rounded-b-lg hover:bg-gray-50"
                    style={{ color: 'var(--danger)' }}
                    role="menuitem"
                  >
                    Sign out →
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>


        {/* Stated once, at the top, instead of being implied by every button. */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-2 text-[11px]"
          style={{ background: 'var(--warning-soft)', color: '#92400e', borderBottom: '1px solid var(--border)' }}
          role="note"
        >
          <span>
            <strong>Read-only database.</strong> Approvals, declines and events are saved in this browser only —
            nothing is written to MariaDB yet, and the map keeps showing server-side statuses.
          </span>
          <button onClick={handleReset} className="underline font-semibold whitespace-nowrap" style={{ color: '#92400e' }}>
            Reset demo data
          </button>
        </div>

        {/* Page content — every visited module stays mounted so its state survives
            a tab switch. MapView and the boundary editor re-measure on re-show. */}
        <main className="flex-1 p-6 overflow-y-auto">
          {visited.includes('overview') && (
            <ModulePane show={active === 'overview'}><Overview /></ModulePane>
          )}
          {visited.includes('events') && (
            <ModulePane show={active === 'events'}><EventManagement /></ModulePane>
          )}
          {visited.includes('submissions') && (
            <ModulePane show={active === 'submissions'}><SubmissionsView /></ModulePane>
          )}
          {visited.includes('map') && (
            <ModulePane show={active === 'map'}><MapView /></ModulePane>
          )}
          {visited.includes('analytics') && (
            <ModulePane show={active === 'analytics'}><Analytics /></ModulePane>
          )}
          {visited.includes('logs') && (
            <ModulePane show={active === 'logs'}><AuditLogs /></ModulePane>
          )}
        </main>
      </div>

      <ToastViewport />
    </div>
  )
}

