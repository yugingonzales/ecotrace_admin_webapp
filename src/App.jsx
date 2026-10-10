import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import ToastViewport from './components/ToastViewport'
import Overview from './components/modules/Overview'
import EventManagement from './components/modules/EventManagement'
import SubmissionsView from './components/modules/SubmissionsView'
import MapView from './components/modules/MapView'
import Analytics from './components/modules/Analytics'
import AuditLogs from './components/modules/AuditLogs'
import { LEGACY_NOTIFICATION_TARGET, MODULE_TITLES, usePortal } from './lib/store'
import { useEscapeToClose } from './lib/useEscapeToClose'
import { useOutsideClick } from './lib/useOutsideClick'
import { useSidebarWidth } from './lib/useSidebarWidth'
import { downloadCsv } from './lib/csv'
import { getProfile, readToken, writeToken } from './lib/api'

/** @typedef {import('react').ReactNode} ReactNode */
/** @typedef {import('./components/Login.jsx').SessionUser} SessionUser */
/** @typedef {import('./lib/store.js').NotifType} NotifType */
/** @typedef {import('./lib/store.js').NotificationTarget} NotificationTarget */

/** @param {string} name @returns {string} */
function getInitials(name) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('') || 'AD'
  )
}

/** @param {number} ts @returns {string} */
function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** @param {NotifType} type @returns {string} */
const notifTone = type => (type === 'error' ? 'badge-danger' : type === 'warning' ? 'badge-warning' : 'badge-accent')

/** @param {NotifType} type @returns {string} */
const notifGlyph = type => (type === 'error' ? '⚠' : type === 'warning' ? '!' : 'i')

/**
 * Where a row will take you, for the row's tooltip and accessible name.
 * @param {NotificationTarget} t
 * @returns {string}
 */
const targetLabel = t => (t.module === 'submissions' ? 'Open in Submissions' : `Go to ${MODULE_TITLES[t.module]}`)

/**
 * A module pane that stays mounted after its first visit.
 *
 * Tabs are switched by hiding panes, not by unmounting them, so filter state,
 * scroll position and half-typed filters survive a tab round trip. Leaflet maps
 * are the exception that needs a nudge on re-show — see `MapAutoResize`.
 *
 * @param {object} props
 * @param {boolean} props.show
 * @param {ReactNode} props.children
 */
function ModulePane({ show, children }) {
  return (
    <div style={{ display: show ? undefined : 'none' }} aria-hidden={!show} inert={!show}>
      {children}
    </div>
  )
}

export default function App() {
  const { active, visited, navigate, notifications, unreadCount, pendingCount, submissions, attention, storeActions } =
    usePortal()
  const [notifOpen, setNotifOpen] = useState(false)
  // Lazy initialiser: the argument is the thunk `readSession`, not a SessionUser.
  const [user, setUser] = useState(/** @type {SessionUser | null} */ (null))
  const [authChecking, setAuthChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const authRequestId = useRef(0)

  useEffect(() => {
    const requestId = ++authRequestId.current
    const token = readToken()
    if (!token) {
      setAuthChecking(false)
      return
    }
    getProfile()
      .then(({ user: profile }) => {
        if (requestId !== authRequestId.current) return
        if (profile?.role_name !== 'admin' && profile?.role !== 'admin') {
          writeToken(null)
          return
        }
        setUser({ name: profile.name, email: profile.email })
      })
      .catch(() => {
        if (requestId === authRequestId.current) writeToken(null)
      })
      .finally(() => {
        if (requestId === authRequestId.current) setAuthChecking(false)
      })
  }, [])

  // Refs for the two header popovers. The trigger refs are handed to the
  // outside-click hook alongside the panel refs, so clicking the bell to close
  // the panel is not immediately undone by the hook dismissing it first.
  // The element type is pinned by casting the argument; `useRef<T>(null)` in a
  // .jsx file parses as a comparison, not a generic.
  const notifBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const notifPanelRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const menuBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const menuPanelRef = useRef(/** @type {HTMLDivElement | null} */ (null))

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

  // Rail width. Held here rather than inside Sidebar because *two* elements
  // render from it — the rail itself and this column's left offset below — and
  // the moment the value can change, two independent copies of it is one
  // pointer move away from the rail and the content overlapping. See
  // `useSidebarWidth` for the rest of that reasoning.
  //
  // Called unconditionally, above the auth/`!user` early returns further down:
  // it is a hook, so skipping it on the signed-out render would break the
  // order for every later render.
  const sidebar = useSidebarWidth()

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

  /**
   * @param {SessionUser} u
   * @param {boolean} remember
   */
  const handleLogin = u => {
    setUser(u)
  }

  const handleLogout = () => {
    // Invalidate any profile request that may still be resolving. Otherwise a
    // late response could immediately restore the user after sign-out.
    authRequestId.current += 1
    writeToken(null)
    setMenuOpen(false)
    setNotifOpen(false)
    setUser(null)
    setAuthChecking(false)
  }

  /** Header shortcut: the submissions register, the portal's primary dataset. */
  const handleExport = () => {
    const rows = submissions.map(s => [
      s.id,
      s.staffName,
      s.staffId,
      s.staffType,
      s.treeTag,
      s.species,
      s.type,
      s.status,
      s.event,
      s.date,
      s.lat,
      s.lng,
      s.incidentType ?? '',
      s.declineReason ?? '',
      s.notes ?? '',
    ])
    const n = downloadCsv(
      'ecotrace_submissions_register.csv',
      [
        'Submission ID',
        'Staff',
        'Staff ID',
        'Staff Type',
        'Tree Tag',
        'Species',
        'Type',
        'Status',
        'Event',
        'Submitted',
        'Latitude',
        'Longitude',
        'Incident Type',
        'Decline Reason',
        'Notes',
      ],
      rows,
    )
    storeActions.recordExport(`Exported the submissions register (CSV) — ${n.toLocaleString()} records`, n)
  }

  /**
   * Follow a notification's destination and dismiss the panel.
   *
   * Closing matters as much as navigating: the popover is anchored to the header
   * and would otherwise sit on top of whatever page the link just opened. The
   * module is split off explicitly rather than spread into `navigate`, so a
   * target field that the destination does not consume can never leak through as
   * an instruction it will silently ignore.
   *
   * @param {NotificationTarget} target
   */
  const goTo = target => {
    if (target.module === 'submissions') {
      navigate('submissions', {
        status: target.status,
        type: target.type,
        treeTag: target.treeTag,
        event: target.event,
      })
    } else {
      navigate(target.module)
    }
    closeNotif()
  }

  if (authChecking) return null
  if (!user) return <Login onLogin={handleLogin} />

  const pageTitle = MODULE_TITLES[active]
  const sortedNotifications = [...notifications].sort((a, b) => b.time - a.time)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar
        active={active}
        onNavigate={m => navigate(m)}
        user={user}
        pendingCount={pendingCount}
        width={sidebar.width}
        maxWidth={sidebar.maxWidth}
        resizing={sidebar.resizing}
        onResizeStart={sidebar.startResize}
        onResizeKeyDown={sidebar.onHandleKeyDown}
        onResizeReset={sidebar.resetWidth}
      />

      {/* Main area. The rail's `width` and this `marginLeft` are one number from
          one hook call — which is the whole reason that number stopped being a
          constant. Two elements at a *fixed* width cannot drift apart; two fed a
          changing width from two places can, and the failure looks like the page
          sliding under the sidebar halfway through a drag. */}
      <div
        style={{
          marginLeft: sidebar.width,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Top header — same forest gradient as the field app's chrome, with the
            module name promoted to the headline and the S.Y. tag as its eyebrow.
            The `sticky top-0 z-30` utilities stay on the element because
            mapStacking.test.js pins them as the map-stacking contract. */}
        <header className="eco-header sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="eco-header-mark" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 18V9" strokeLinecap="round" />
                <path
                  d="M10 9C10 9 4.5 8.4 3 3.5c4.8-.6 7 2.6 7 5.5z"
                  fill="currentColor"
                  stroke="none"
                  opacity="0.9"
                />
                <path
                  d="M10 11.5c0 0 4.9-1 6.4-5.4-4.4-.5-6.4 2.6-6.4 5.4z"
                  fill="currentColor"
                  stroke="none"
                  opacity="0.65"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="eco-header-eyebrow">S.Y. 2025–2026 · UEP EcoTrace</div>
              <h1 className="eco-header-title truncate">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Notification bell */}
            <div className="relative">
              <button
                ref={notifBtnRef}
                className="eco-header-icon-btn"
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
                {unreadCount > 0 && <span className="eco-header-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>

              {notifOpen && (
                <div ref={notifPanelRef} className="eco-header-panel w-80">
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
                            <span
                              className="mt-1 shrink-0 text-sm leading-none"
                              style={{ color: 'var(--text-faint)' }}
                              aria-hidden="true"
                            >
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
                            background: n.read ? 'var(--field)' : 'var(--accent-soft)',
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
                          <span
                            className="mt-1 shrink-0 text-sm leading-none"
                            style={{ color: 'var(--text-faint)' }}
                            aria-hidden="true"
                          >
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
            <button className="eco-header-btn" onClick={handleExport} title="Download the submissions register as CSV">
              Export ↓
            </button>

            {/* Admin avatar */}
            <div className="relative">
              <button
                ref={menuBtnRef}
                className="eco-avatar"
                style={{ width: 34, height: 34, fontSize: 12 }}
                onClick={toggleMenu}
                title={user.email}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {getInitials(user.name)}
              </button>
              {menuOpen && (
                <div ref={menuPanelRef} className="eco-header-panel w-64" role="menu">
                  <div className="px-4 py-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-medium" style={{ color: 'var(--text)' }}>
                      {user.name}
                    </div>
                    <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {user.email}
                    </div>
                  </div>
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
        {/* Page content — every visited module stays mounted so its state survives

            a tab switch. MapView and the boundary editor re-measure on re-show. */}
        <main className="flex-1 p-6 overflow-y-auto">
          {visited.includes('overview') && (
            <ModulePane show={active === 'overview'}>
              <Overview />
            </ModulePane>
          )}
          {visited.includes('events') && (
            <ModulePane show={active === 'events'}>
              <EventManagement />
            </ModulePane>
          )}
          {visited.includes('submissions') && (
            <ModulePane show={active === 'submissions'}>
              <SubmissionsView />
            </ModulePane>
          )}
          {visited.includes('map') && (
            <ModulePane show={active === 'map'}>
              <MapView />
            </ModulePane>
          )}
          {visited.includes('analytics') && (
            <ModulePane show={active === 'analytics'}>
              <Analytics />
            </ModulePane>
          )}
          {visited.includes('logs') && (
            <ModulePane show={active === 'logs'}>
              <AuditLogs />
            </ModulePane>
          )}
        </main>
      </div>

      <ToastViewport />
    </div>
  )
}
