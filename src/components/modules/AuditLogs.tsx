import { useState } from 'react'

const logs = [
  { id: 'LOG-1044', time: '2026-04-28 10:42:31', admin: 'Admin Jane', adminId: 'ADM-001', action: 'BATCH_APPROVE', detail: 'Approved 45 submissions via batch process', count: 45, module: 'Submissions' },
  { id: 'LOG-1043', time: '2026-04-28 10:15:09', admin: 'Admin Rex', adminId: 'ADM-002', action: 'BATCH_DECLINE', detail: 'Declined 3 submissions — Reason: Inaccurate Photo', count: 3, module: 'Submissions' },
  { id: 'LOG-1042', time: '2026-04-28 09:51:44', admin: 'Admin Jane', adminId: 'ADM-001', action: 'EVENT_CREATE', detail: 'Created event: Arbor Day Drive 2026', count: null, module: 'Events' },
  { id: 'LOG-1041', time: '2026-04-28 09:30:18', admin: 'Admin Carl', adminId: 'ADM-003', action: 'INCIDENT_FLAG', detail: 'Flagged high-priority incident: Destroyed planting area (Zone B, TRE-0567)', count: null, module: 'Submissions' },
  { id: 'LOG-1040', time: '2026-04-28 09:14:55', admin: 'System', adminId: 'SYS', action: 'ALERT_SENT', detail: 'High-priority incident report received from J. Santos (SUB-4421)', count: null, module: 'System' },
  { id: 'LOG-1039', time: '2026-04-28 08:55:12', admin: 'Admin Jane', adminId: 'ADM-001', action: 'EVENT_EXTEND', detail: 'Extended event end date by 7 days: Earth Month 2026 → May 7, 2026', count: null, module: 'Events' },
  { id: 'LOG-1038', time: '2026-04-27 16:30:00', admin: 'Admin Rex', adminId: 'ADM-002', action: 'EXPORT', detail: 'Exported verification log (PDF) for Earth Month 2026 — 940 records', count: null, module: 'Reports' },
  { id: 'LOG-1037', time: '2026-04-27 14:05:33', admin: 'Admin Carl', adminId: 'ADM-003', action: 'SINGLE_APPROVE', detail: 'Approved submission SUB-4418 (Ana Lim, TRE-0341)', count: 1, module: 'Submissions' },
  { id: 'LOG-1036', time: '2026-04-27 11:22:17', admin: 'Admin Rex', adminId: 'ADM-002', action: 'SINGLE_DECLINE', detail: 'Declined submission SUB-4417 — Reason: Location Mismatch', count: 1, module: 'Submissions' },
  { id: 'LOG-1035', time: '2026-04-27 09:00:00', admin: 'Admin Jane', adminId: 'ADM-001', action: 'QUOTA_REASSIGN', detail: 'Bulk quota reassignment — Earth Month Campaign: 5 → 3 trees/staff', count: null, module: 'Events' },
  { id: 'LOG-1034', time: '2026-04-26 17:45:00', admin: 'Admin Jane', adminId: 'ADM-001', action: 'STAFF_EXEMPT', detail: 'Removed staff STF-004 (Ana Lim) from Campus Reforestation Q2 — Medical exemption', count: null, module: 'Staff' },
  { id: 'LOG-1033', time: '2026-04-26 15:10:22', admin: 'Admin Carl', adminId: 'ADM-003', action: 'BATCH_RESUBMIT', detail: 'Requested re-submission for 12 entries — Missing GPS data', count: 12, module: 'Submissions' },
]

const actionBadge: Record<string, string> = {
  BATCH_APPROVE: 'badge-accent',
  SINGLE_APPROVE: 'badge-accent',
  BATCH_DECLINE: 'badge-danger',
  SINGLE_DECLINE: 'badge-danger',
  BATCH_RESUBMIT: 'badge-info',
  EVENT_CREATE: 'badge-info',
  EVENT_EXTEND: 'badge-info',
  INCIDENT_FLAG: 'badge-warning',
  ALERT_SENT: 'badge-warning',
  EXPORT: 'badge-neutral',
  QUOTA_REASSIGN: 'badge-neutral',
  STAFF_EXEMPT: 'badge-neutral',
}
function actionLabel(action: string): string {
  return action
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

export default function AuditLogs() {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')

  const filtered = logs.filter(l => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
    if (search && ![l.admin, l.action, l.detail, l.id].some(v => v.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Audit & Activity Logs</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full record of administrative actions — tamper-evident, time-stamped</p>
        </div>
        <button className="btn btn-primary btn-sm">Export Logs ↓</button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" stroke="var(--text-muted)" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            className="input text-xs"
            style={{ paddingLeft: 30 }}
            placeholder="Search by admin, action, or log ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select text-xs"
          style={{ width: 'auto' }}
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
        >
          <option value="all">All Modules</option>
          <option>Submissions</option>
          <option>Events</option>
          <option>Staff</option>
          <option>Reports</option>
          <option>System</option>
        </select>
        <input type="date" className="input text-xs" style={{ width: 'auto' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" className="input text-xs" style={{ width: 'auto' }} />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Timestamp</th>
              <th>Admin</th>
              <th className="text-center">Action</th>
              <th>Detail</th>
              <th className="text-center">Module</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const ab = actionBadge[log.action] || 'badge-neutral'
              return (
                <tr key={log.id}>
                  <td>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{log.id}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{log.time}</span>
                  </td>
                  <td>
                    <div className="font-medium">{log.admin}</div>
                    <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{log.adminId}</div>
                  </td>
                  <td className="text-center">
                    <span className={`badge ${ab}`}>
                      {actionLabel(log.action)}
                      {log.count && log.count > 1 ? ` (${log.count})` : ''}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: 360 }}>
                    <div className="truncate">{log.detail}</div>
                  </td>
                  <td className="text-center">
                    <span className="badge badge-neutral">{log.module}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>Showing {filtered.length} of {logs.length} log entries (last 24 hours)</span>
          <button className="btn btn-sm">Load older entries →</button>
        </div>
      </div>
    </div>
  )
}