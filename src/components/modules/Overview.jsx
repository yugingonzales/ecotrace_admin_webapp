import { activeEvents, eventProgress, usePortal } from '../../lib/store'

/**
 * @typedef {object} StatCardProps
 * @property {string} label
 * @property {string | number} value
 * @property {string} [sub]
 * @property {string} [color]
 * @property {string} [delta]
 * @property {boolean} [positive]
 */

/** @param {StatCardProps} props */
function StatCard({ label, value, sub, color = 'var(--text)', delta, positive }) {
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

/**
 * Audit actions mapped to the badge tones used in the activity feed.
 * @type {Record<string, string>}
 */
const typeStyle = {
  BATCH_APPROVE: 'badge-accent',
  SINGLE_APPROVE: 'badge-accent',
  BATCH_DECLINE: 'badge-warning',
  SINGLE_DECLINE: 'badge-warning',
  BATCH_RESUBMIT: 'badge-info',
  EVENT_CREATE: 'badge-info',
  EVENT_PUBLISH: 'badge-info',
  EVENT_EXTEND: 'badge-info',
  QUOTA_REASSIGN: 'badge-info',
  INCIDENT_FLAG: 'badge-danger',
  ALERT_SENT: 'badge-danger',
  EXPORT: 'badge-neutral',
  STAFF_EXEMPT: 'badge-neutral',
}

/**
 * '2026-04-28 10:42:31' -> '10:42 AM', or 'Yesterday, 08:55 AM' / a date.
 * @param {string} stamp
 * @returns {string}
 */
function shortTime(stamp) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(stamp ?? '')
  if (!m) return stamp
  const hours = Number(m[2])
  const clock = `${((hours + 11) % 12) + 1}:${m[3]} ${hours < 12 ? 'AM' : 'PM'}`
  /** @param {Date} d */
  const isoOfDay = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (m[1] === isoOfDay(new Date())) return clock
  if (m[1] === isoOfDay(new Date(Date.now() - 86400000))) return `Yesterday, ${clock}`
  return `${m[1]} ${clock}`
}

export default function Overview() {
  const { events, logs, pendingCount, incidentCount, submissions } = usePortal()

  // Every figure below is derived. The dashboard used to hard-code
  // 2,195 / 80 / 47 / 12, so approving a submission changed nothing here and the
  // sidebar badge said 47 no matter what was approved.
  const running = activeEvents(events)
  const totalVerified = running.reduce((n, e) => n + e.verified, 0)
  const totalTarget = running.reduce((n, e) => n + e.target, 0)
  const totalStaff = running.reduce((n, e) => n + e.staff, 0)
  const feed = logs.slice(0, 7)
  const approvedCount = submissions.filter(s => s.status === 'approved').length
  const declinedCount = submissions.filter(s => s.status === 'declined').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Command Overview</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          S.Y. 2025–2026 · {running.length} Active Event{running.length === 1 ? '' : 's'} · Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard
          label="Total Trees Verified"
          value={totalVerified.toLocaleString()}
          sub={totalTarget > 0 ? `of ${totalTarget.toLocaleString()} target` : 'no targets set yet'}
          delta={`${approvedCount} approved here`}
          positive
        />
        <StatCard
          label="Active Staff"
          value={totalStaff > 0 ? totalStaff.toLocaleString() : '—'}
          sub={`across ${running.length} event${running.length === 1 ? '' : 's'}`}
        />
        <StatCard label="Pending Submissions" value={pendingCount} sub="awaiting review" color="var(--warning)" />
        <StatCard
          label="Incident Reports"
          value={incidentCount}
          sub={`${declinedCount} declined by an admin`}
          color="var(--danger)"
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Active Events */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="card-title">Active Events</h2>
            <span className="badge badge-accent">{running.length} running</span>
          </div>
          {running.length === 0 && (
            <div className="px-4 py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No active events. Create one in Event Management.
            </div>
          )}
          {running.map((ev) => {
            const pct = eventProgress(ev)
            return (
              <div key={ev.id} className="px-4 py-3.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <div className="text-sm font-medium">{ev.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {ev.staff > 0 ? `${ev.staff.toLocaleString()} staff members · ` : ''}ends {ev.end}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold mono" style={{ color: 'var(--accent-dark)' }}>
                      {ev.verified.toLocaleString()} / {ev.target > 0 ? ev.target.toLocaleString() : '—'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>trees</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="progress flex-1">
                    <div style={{ width: `${pct ?? 0}%`, background: (pct ?? 0) > 80 ? 'var(--accent)' : (pct ?? 0) > 40 ? 'var(--warning)' : 'var(--accent-dark)' }} />
                  </div>
                  <span className="text-xs font-medium mono" style={{ color: 'var(--text-muted)', minWidth: 34 }}>
                    {pct === null ? '—' : `${pct}%`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity Log — fed by the same audit rows the Audit Logs tab shows */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Activity</h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
            {feed.length === 0 && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
                No activity yet
              </div>
            )}
            {feed.map((item) => (
              <div key={item.id} className="flex gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className={`badge ${typeStyle[item.action] || 'badge-neutral'}`} style={{ padding: '1px 7px', alignSelf: 'flex-start' }}>
                  •
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs leading-snug" style={{ color: 'var(--text)' }}>{item.detail}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {item.admin} · {shortTime(item.time)}
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