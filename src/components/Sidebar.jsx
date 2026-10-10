import uepLogo from '../assets/uep_logo.jpg'
// Only the *floor* is imported, for `aria-valuemin`. The floor is
// viewport-independent — `sidebarMaxWidth` never returns below it — so reading
// the shared constant is exact, not an approximation. The ceiling is not: the
// viewport can lower it, which is why it arrives as a prop instead.
import { SIDEBAR_MIN_WIDTH } from '../lib/useSidebarWidth'

/** @typedef {import('../lib/store.js').Module} Module */

/**
 * The rail's width is no longer a constant defined here. It used to be —
 * `export const SIDEBAR_WIDTH = 244` — and this module and App.jsx were the only
 * two readers, which is why it could safely live in one of them. A draggable
 * rail invalidates that: the number now changes on every pointer move, and two
 * independent copies of a moving value is precisely how a sidebar and the
 * content column beside it end up overlapping mid-drag. So the width moved up
 * into `useSidebarWidth` (src/lib), which App.jsx calls once and passes back
 * down to both this component and the main column. There is still exactly one
 * value; it is just live now.
 *
 * @typedef {object} SidebarProps
 * @property {Module} active
 * @property {(m: Module) => void} onNavigate
 * @property {{ name: string, email?: string }} [user]
 * @property {number} pendingCount Pending-submission count from the store. This
 *   badge used to be a hard-coded `47` that no action could ever move — it now
 *   tracks real state, so approving something in Submissions visibly decrements it.
 * @property {number} width Live rail width, owned by `useSidebarWidth`.
 * @property {number} maxWidth Effective ceiling for the current viewport. The
 *   viewport can cap the rail below `SIDEBAR_MAX_WIDTH`, and `aria-valuemax`
 *   should report what the user can actually reach, not the static ceiling.
 * @property {boolean} resizing True while a drag is in flight; suppresses the
 *   rail's transitions so the edge tracks the pointer instead of easing to it.
 * @property {(e: import('react').PointerEvent<HTMLElement>) => void} onResizeStart
 * @property {(e: import('react').KeyboardEvent<HTMLElement>) => void} onResizeKeyDown
 * @property {() => void} onResizeReset
 */

/**
 * @param {string} name
 * @returns {string}
 */
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

/**
 * Nav entries. The `id` values are the `Module` union; annotating the array
 * element type replaces the six per-item `as Module` casts the TS version needed.
 * @type {{ id: Module, label: string, badge?: boolean, icon: import('react').ReactNode }[]}
 */
const nav = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: 'events',
    label: 'Event Management',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="14" height="12" rx="1" />
        <path d="M5 1v4M11 1v4M1 7h14" />
      </svg>
    ),
  },
  {
    id: 'submissions',
    label: 'Submissions',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12M2 8h8M2 12h10" />
        <circle cx="13" cy="11" r="2.5" />
        <path d="M12.3 11l.5.5 1-1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map View',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1C5.8 1 4 2.8 4 5c0 3 4 9 4 9s4-6 4-9c0-2.2-1.8-4-4-4z" />
        <circle cx="8" cy="5" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 13L6 8l3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'logs',
    label: 'Audit Logs',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="1" width="10" height="13" rx="1" />
        <path d="M5 5h5M5 8h5M5 11h3" />
        <path d="M12 5l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

/** @param {SidebarProps} props */
export default function Sidebar({
  active,
  onNavigate,
  user,
  pendingCount,
  width,
  maxWidth,
  resizing,
  onResizeStart,
  onResizeKeyDown,
  onResizeReset,
}) {
  return (
    <aside
      className={`eco-sidebar${resizing ? ' eco-sidebar-resizing' : ''}`}
      // `minWidth` as well as `width`: the rail is a flex item in App's row, so
      // `width` alone is only a suggestion — flex-shrink can take it below the
      // value we just handed it, and the rail would then disagree with the main
      // column's `marginLeft`, which is the exact drift this hook exists to
      // prevent. `minWidth` pins the box the two of them share.
      style={{ width, minWidth: width }}
    >
      {/* Brand — the deep-forest source colour and lemon accent come straight
          from the field app's theme tokens, so both surfaces read as one product. */}
      <div className="eco-sidebar-brand">
        <div className="eco-sidebar-logo">
          <img
            src={uepLogo}
            alt="UEP Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: 2,
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="eco-sidebar-wordmark" title="EcoTrace Admin">
            Eco<em>Trace</em> Admin
          </div>
          <div className="eco-sidebar-eyebrow">UEP Monitoring</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-1 overflow-y-auto" style={{ paddingLeft: 12, paddingRight: 12 }}>
        <div className="eco-sidebar-section" style={{ paddingLeft: 6 }}>
          Navigation
        </div>
        {nav.map(item => {
          const isActive = active === item.id
          const badge = item.id === 'submissions' && pendingCount > 0 ? pendingCount : null
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`eco-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="eco-nav-icon">{item.icon}</span>
              {/* `truncate` carries `overflow: hidden`, and that is load-bearing
                  beyond the visual ellipsis: an overflowing flex child has an
                  automatic minimum size of 0 only when its overflow is not
                  `visible`. Leave it off and the label refuses to shrink past
                  its content, pushing the pending badge clean out of the rail at
                  the 200px floor. The `title` keeps the full label readable once
                  the ellipsis eats it. */}
              <span className="flex-1 truncate" title={item.label}>
                {item.label}
              </span>
              {badge !== null && (
                <span
                  className="badge badge-danger"
                  style={{ padding: '0 6px' }}
                  title={`${badge} pending submission${badge === 1 ? '' : 's'}`}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="eco-sidebar-footer">
        <div className="flex items-center gap-2.5">
          <div className="eco-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
            {getInitials(user?.name ?? 'Admin Jane')}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: '#eaf7ee' }}>
              {user?.name ?? 'Admin Jane'}
            </div>
            <div className="eco-sidebar-eyebrow">Administrator</div>
          </div>
        </div>
      </div>

      {/* ── Resize handle ─────────────────────────────────────────────────────
          A `separator`, not a `slider`: it moves the boundary between two panes,
          which is exactly what the role means, and the value triple below lets a
          screen reader announce a width instead of an unlabelled button.
          `aria-valuemin` is read from the shared constant because the floor is
          absolute — `sidebarMaxWidth` never returns below it — while
          `aria-valuemax` comes from the hook because a narrow viewport can lower
          it. Rendered last so it wins paint order against the nav's scrollbar
          and the footer's border, both of which sit on this same edge. */}
      <button
        type="button"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize navigation sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={maxWidth}
        title="Drag to resize · double-click to reset"
        className={`eco-sidebar-resize${resizing ? ' is-dragging' : ''}`}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
        onDoubleClick={onResizeReset}
      />
    </aside>
  )
}
