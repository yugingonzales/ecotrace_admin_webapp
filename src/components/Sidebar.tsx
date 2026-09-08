import uepLogo from '../assets/uep_logo.jpg'

type Module = 'overview' | 'events' | 'submissions' | 'map' | 'analytics' | 'logs'

interface SidebarProps {
  active: Module
  onNavigate: (m: Module) => void
  user?: { name: string; email?: string }
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

const nav = [
  {
    id: 'overview' as Module,
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
    id: 'events' as Module,
    label: 'Event Management',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="14" height="12" rx="1" />
        <path d="M5 1v4M11 1v4M1 7h14" />
      </svg>
    ),
  },
  {
    id: 'submissions' as Module,
    label: 'Submissions',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12M2 8h8M2 12h10" />
        <circle cx="13" cy="11" r="2.5" />
        <path d="M12.3 11l.5.5 1-1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    badge: 47,
  },
  {
    id: 'map' as Module,
    label: 'Map View',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1C5.8 1 4 2.8 4 5c0 3 4 9 4 9s4-6 4-9c0-2.2-1.8-4-4-4z" />
        <circle cx="8" cy="5" r="1.5" />
      </svg>
    ),
  },
  {
    id: 'analytics' as Module,
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 13L6 8l3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'logs' as Module,
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

export default function Sidebar({ active, onNavigate, user }: SidebarProps) {
  return (
    <aside
      className="flex flex-col"
      style={{
        width: 220,
        minWidth: 220,
        background: '#fff',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0"
          style={{ width: 34, height: 34, background: '#fff', border: '1px solid var(--border)' }}
        >
          <img src={uepLogo} alt="UEP Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
        </div>
        <div>
          <div className="font-semibold" style={{ color: 'var(--text)', fontSize: 14 }}>
            EcoTrace
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            Admin
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        <div className="text-[11px] font-medium uppercase tracking-wide mb-2 px-2" style={{ color: 'var(--text-faint)' }}>
          Navigation
        </div>
        {nav.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-md mb-0.5"
              style={{
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                color: isActive ? 'var(--accent-dark)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-dark)' : 'var(--text-faint)' }}>{item.icon}</span>
              <span className="text-xs flex-1">{item.label}</span>
              {item.badge && (
                <span className="badge badge-danger" style={{ padding: '0 6px' }}>{item.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full text-xs font-semibold"
            style={{ width: 30, height: 30, background: 'var(--accent-soft)', color: 'var(--accent-dark)' }}
          >
            {getInitials(user?.name ?? 'Admin Jane')}
          </div>
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{user?.name ?? 'Admin Jane'}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Administrator</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
