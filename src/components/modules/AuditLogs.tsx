import { useState } from 'react'
import { stampDate, usePortal } from '../../lib/store'
import { downloadCsv } from '../../lib/csv'

// The log rows themselves live in the store (`lib/store.tsx`) so that approving
// a submission or creating an event shows up here immediately, and so
// "Load older entries" and the CSV export see exactly the same rows.

const actionBadge: Record<string, string> = {
  BATCH_APPROVE: 'badge-accent',
  SINGLE_APPROVE: 'badge-accent',
  BATCH_DECLINE: 'badge-danger',
  SINGLE_DECLINE: 'badge-danger',
  BATCH_RESUBMIT: 'badge-info',
  EVENT_CREATE: 'badge-info',
  EVENT_PUBLISH: 'badge-info',
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
  const { logs, storeActions } = usePortal()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const needle = search.trim().toLowerCase()

  const filtered = logs.filter(l => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
    // `stampDate` strips the time half so a `2026-04-28 10:42:31` MariaDB
    // timestamp compares correctly against a plain `YYYY-MM-DD` input value.
    const day = stampDate(l.time)
    if (from && day < from) return false
    if (to && day > to) return false
    if (needle && ![l.admin, l.action, l.detail, l.id].some(v => v.toLowerCase().includes(needle))) return false
    return true
  })

  const modules = [...new Set(logs.map(l => l.module))].sort()
  const olderPagesLoaded = storeActions.olderPagesLoaded
  const olderPagesAvailable = storeActions.olderPagesAvailable

  const exportCsv = () => {
    const n = downloadCsv(
      'ecotrace_audit_log.csv',
      ['Log ID', 'Timestamp', 'Admin', 'Admin ID', 'Action', 'Detail', 'Count', 'Module'],
      filtered.map(l => [l.id, l.time, l.admin, l.adminId, l.action, l.detail, l.count ?? '', l.module]),
    )
    storeActions.recordExport(`Exported the audit log (CSV) — ${n.toLocaleString()} of ${filtered.length} filtered rows`, n)
  }

  return (
    <div>
    <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Audit & Activity Logs</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Full record of administrative actions — tamper-evident, time-stamped</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={exportCsv}>
          Export CSV ↓
        </button>
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
          aria-label="Filter by module"
        >
          <option value="all">All Modules</option>
          {modules.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="date"
          className="input text-xs"
          style={{ width: 'auto' }}
          value={from}
          max={to || undefined}
          onChange={e => setFrom(e.target.value)}
          aria-label="From date"
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
        <input
          type="date"
          className="input text-xs"
          style={{ width: 'auto' }}
          value={to}
          min={from || undefined}
          onChange={e => setTo(e.target.value)}
          aria-label="To date"
        />
        {(needle || moduleFilter !== 'all' || from || to) && (
          <button
            className="btn btn-sm"
            onClick={() => { setSearch(''); setModuleFilter('all'); setFrom(''); setTo('') }}
          >
            Clear filters
          </button>
        )}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No log entries match the current filters.
                </td>
              </tr>
            )}
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
          <span>
            Showing {filtered.length} of {logs.length} loaded log entries
            {olderPagesAvailable > 0 && ` · ${olderPagesAvailable - olderPagesLoaded} older page(s) available`}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => storeActions.loadOlderLogs()}
            disabled={olderPagesLoaded >= olderPagesAvailable}
            title={
              olderPagesLoaded >= olderPagesAvailable
                ? 'All available history is already loaded'
                : 'Reveal the next page of audit history'
            }
          >
            {olderPagesLoaded >= olderPagesAvailable ? 'All history loaded' : 'Load older entries →'}
          </button>
        </div>
      </div>
    </div>
  )
}