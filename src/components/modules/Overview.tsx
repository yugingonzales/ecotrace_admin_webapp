interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  delta?: string
  positive?: boolean
}

function StatCard({ label, value, sub, color = 'var(--text)', delta, positive }: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ fontFamily: 'inherit', color, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      {delta && (
        <div className="text-xs mt-1.5 font-medium" style={{ color: positive ? 'var(--accent)' : 'var(--danger)' }}>
          {positive ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  )
}

const recentActivity = [
  { time: '10:42 AM', admin: 'Admin Jane', action: 'Approved 45 submissions via batch', type: 'approve' },
  { time: '10:15 AM', admin: 'Admin Rex', action: 'Declined 3 submissions — Inaccurate Photo', type: 'decline' },
  { time: '09:51 AM', admin: 'Admin Jane', action: 'Created Event: Arbor Day Drive 2026', type: 'create' },
  { time: '09:30 AM', admin: 'Admin Carl', action: 'Flagged incident: Destroyed planting area (Zone B)', type: 'incident' },
  { time: '08:55 AM', admin: 'System', action: 'High-priority incident report received from J. Santos', type: 'incident' },
  { time: '08:20 AM', admin: 'Admin Jane', action: 'Extended event deadline by 7 days: Earth Month 2026', type: 'create' },
  { time: 'Yesterday', admin: 'Admin Rex', action: 'Exported verification log (PDF) for Earth Month 2026', type: 'export' },
]

const typeStyle: Record<string, string> = {
  approve: 'badge-accent',
  decline: 'badge-warning',
  create: 'badge-info',
  incident: 'badge-danger',
  export: 'badge-neutral',
}

const activeEvents = [
  { name: 'Arbor Day Drive 2026', daysLeft: 8, verified: 1680, target: 2250, staff: 45 },
  { name: 'Earth Month Campaign', daysLeft: 22, verified: 420, target: 1000, staff: 20 },
  { name: 'Campus Reforestation Q2', daysLeft: 45, verified: 95, target: 750, staff: 15 },
]
export default function Overview() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Command Overview</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>S.Y. 2025–2026 · 3 Active Events · Last updated 10:45 AM</p>
      </div>

      {/* Top Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Total Trees Verified" value="2,195" sub="of 4,000 target" delta="12% this week" positive />
        <StatCard label="Active Staff" value="80" sub="across 3 events" />
        <StatCard label="Pending Submissions" value="47" sub="awaiting review" color="var(--warning)" />
        <StatCard label="Incident Reports" value="12" sub="high-priority: 2" color="var(--danger)" delta="3 new today" positive={false} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Active Events */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="card-title">Active Events</h2>
            <span className="badge badge-accent">3 running</span>
          </div>
          {activeEvents.map((ev) => {
            const pct = Math.round((ev.verified / ev.target) * 100)
            return (
              <div key={ev.name} className="px-4 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <div className="text-sm font-medium">{ev.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {ev.staff.toLocaleString()} staff members · {ev.daysLeft}d remaining
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold mono" style={{ color: 'var(--accent-dark)' }}>
                      {ev.verified.toLocaleString()} / {ev.target.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>trees</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="progress flex-1">
                    <div style={{ width: `${pct}%`, background: pct > 80 ? 'var(--accent)' : pct > 40 ? 'var(--warning)' : 'var(--accent-dark)' }} />
                  </div>
                  <span className="text-xs font-medium mono" style={{ color: 'var(--text-muted)', minWidth: 34 }}>
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity Log */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Activity</h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
            {recentActivity.map((item, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className={`badge ${typeStyle[item.type] || typeStyle.create}`} style={{ padding: '1px 7px', alignSelf: 'flex-start' }}>
                  •
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs leading-snug" style={{ color: 'var(--text)' }}>{item.action}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {item.admin} · {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}