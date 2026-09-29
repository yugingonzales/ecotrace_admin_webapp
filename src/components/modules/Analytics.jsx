import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { usePortal } from '../../lib/store'
import { downloadCsv } from '../../lib/csv'

/** Staff rows per page for the progress table. */
const STAFF_PAGE_SIZE = 5

const weeklyVerifications = [
  { day: 'Mon', approved: 14, declined: 8, incidents: 3 },
  { day: 'Tue', approved: 52, declined: 12, incidents: 5 },
  { day: 'Wed', approved: 44, declined: 6, incidents: 2 },
  { day: 'Thu', approved: 61, declined: 15, incidents: 7 },
  { day: 'Fri', approved: 50, declined: 9, incidents: 4 },
  { day: 'Sat', approved: 22, declined: 4, incidents: 1 },
  { day: 'Sun', approved: 14, declined: 2, incidents: 0 },
]

const speciesSurvival = [
  { species: 'Narra', planted: 520, verified: 488, rate: 93.8 },
  { species: 'Molave', planted: 380, verified: 341, rate: 89.7 },
  { species: 'Mahogany', planted: 440, verified: 420, rate: 95.5 },
  { species: 'Ipil', planted: 290, verified: 258, rate: 89.0 },
  { species: 'Banaba', planted: 310, verified: 285, rate: 91.9 },
  { species: 'Kamagong', planted: 180, verified: 155, rate: 86.1 },
]

// Scoped to the three types the dashboard reports on. `Pest Infestation` and
// `Tag Misplacement` were dropped on request; the donut and its legend both read
// this array, so the two views stay in step automatically.
const incidentTypes = [
  { name: 'Dead / Uprooted', value: 38, color: 'var(--danger)' },
  { name: 'Location Mismatch', value: 22, color: 'var(--warning)' },
  { name: 'Restricted Area', value: 8, color: '#ec4899' },
]

// `staffProgress` used to be a hard-coded 8-row table that no filter or button
// could touch. It is now derived from the store's submissions, so approving a
// submission in Submissions moves the bar here.

const monthlyTrend = [
  { month: 'Jan', verified: 120, incidents: 5 },
  { month: 'Feb', verified: 280, incidents: 12 },
  { month: 'Mar', verified: 680, incidents: 28 },
  { month: 'Apr', verified: 1680, incidents: 12 },
]

/** @param {{ children: import('react').ReactNode }} props */
function SectionLabel({ children }) {
  return (
    <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>{children}</div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text)' },
  itemStyle: { color: 'var(--text)', fontSize: 11 },
  labelStyle: { color: 'var(--text-muted)', fontSize: 11 },
}
export default function Analytics() {
  const { events, submissions, storeActions } = usePortal()
  const [eventFilter, setEventFilter] = useState('all')
  const [staffType, setStaffType] = useState('all')
  const [staffSearch, setStaffSearch] = useState('')
  const [staffLimit, setStaffLimit] = useState(STAFF_PAGE_SIZE)

  const relevant = eventFilter === 'all'
    ? submissions
    : submissions.filter(s => s.event === eventFilter)

  /**
   * Per-staff approval progress, computed from the submissions themselves.
   *
   * The old table claimed a "quota" of 5 trees per staff, which no field in the
   * data supports — the event quota is 50 trees per staff and no staff roster
   * endpoint exists yet. The honest, computable figure is "approved out of
   * submitted", so that is what this shows.
   */
  /**
   * The accumulator held while counting. `rate` is deliberately absent -- it is
   * only computed by the `.map()` once totals are final, and declaring it here
   * would let a `row.rate` read compile before it exists.
   * @typedef {object} StaffTally
   * @property {string} name
   * @property {string} id
   * @property {string} staffType
   * @property {number} total
   * @property {number} approved
   */

  /** @typedef {StaffTally & { rate: number }} StaffProgressRow */

  const staffProgress = useMemo(/** @returns {StaffProgressRow[]} */ () => {
    /** @type {Map<string, StaffTally>} */
    const byStaff = new Map()
    for (const s of relevant) {
      const row = byStaff.get(s.staffId) ?? { name: s.staffName, id: s.staffId, staffType: s.staffType, total: 0, approved: 0 }
      row.total += 1
      if (s.status === 'approved') row.approved += 1
      byStaff.set(s.staffId, row)
    }
    return [...byStaff.values()]
      .map(r => ({ ...r, rate: r.total > 0 ? Math.round((r.approved / r.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name))
  }, [relevant])

  const needle = staffSearch.trim().toLowerCase()
  const visibleStaff = staffProgress.filter(s => {
    if (staffType !== 'all' && s.staffType !== staffType) return false
    if (needle && ![s.name, s.id, s.staffType].some(v => v.toLowerCase().includes(needle))) return false
    return true
  })

  const exportCsv = () => {
    const n = downloadCsv(
      `ecotrace_analytics_${eventFilter === 'all' ? 'all_events' : eventFilter.replace(/\W+/g, '_').toLowerCase()}.csv`,
      ['Event', 'Staff', 'Staff ID', 'Staff Type', 'Submissions', 'Approved', 'Approval Rate %'],
      relevant.map(s => [s.event, s.staffName, s.staffId, s.staffType, 1, s.status === 'approved' ? 1 : 0, s.status === 'approved' ? 100 : 0]),
    )
    storeActions.recordExport(`Exported analytics submissions (CSV) — ${n.toLocaleString()} records`, n)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Analytics & Progress</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            S.Y. 2025–2026 · {eventFilter === 'all' ? 'All events' : eventFilter}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <select
            className="select text-xs"
            style={{ width: 'auto' }}
            value={eventFilter}
            onChange={e => { setEventFilter(e.target.value); setStaffLimit(STAFF_PAGE_SIZE) }}
            aria-label="Filter by event"
          >
            <option value="all">All Events</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.name}>{ev.name}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-primary" onClick={exportCsv}>
            Export CSV ↓
          </button>
        </div>
      </div>

      {/* Top KPIs — derived from the same filtered slice as the table below. */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          {
            label: 'Submission Approval Rate',
            value: relevant.length > 0
              ? `${Math.round((relevant.filter(s => s.status === 'approved').length / relevant.length) * 100)}%`
              : '—',
            sub: `${relevant.filter(s => s.status === 'approved').length} of ${relevant.length} submissions`,
            color: 'var(--accent)',
          },
          {
            label: 'Awaiting Review',
            value: relevant.filter(s => s.status === 'pending').length.toLocaleString(),
            sub: 'still pending',
            color: 'var(--warning)',
          },
          {
            label: 'Incident Rate',
            value: relevant.length > 0
              ? `${((relevant.filter(s => s.type === 'incident').length / relevant.length) * 100).toFixed(1)}%`
              : '—',
            sub: 'of submissions in scope',
            color: 'var(--danger)',
          },
          {
            label: 'Staff Submitting',
            value: staffProgress.length.toLocaleString(),
            sub: 'distinct staff IDs',
            color: 'var(--info)',
          },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{k.label}</div>
            <div className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Weekly Verifications Chart */}
        <div className="card p-4">
          <SectionLabel>Weekly Verification Activity</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyVerifications} barSize={16} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="approved" name="Approved" fill="var(--accent)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="declined" name="Declined" fill="var(--warning)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="incidents" name="Incidents" fill="var(--danger)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'var(--accent)' }} />Approved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'var(--warning)' }} />Declined</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'var(--danger)' }} />Incidents</span>
          </div>
        </div>
{/* Incident Breakdown */}
        <div className="card p-4">
          <SectionLabel>Incident Type Breakdown</SectionLabel>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={incidentTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {incidentTypes.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {incidentTypes.map(t => (
                <div key={t.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.name}</span>
                  </div>
                  <span className="text-xs font-semibold mono" style={{ color: t.color }}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Species Survival Rate */}
        <div className="card p-4">
          <SectionLabel>Species Survival Rate</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={speciesSurvival} layout="vertical" barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" domain={[80, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="species" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={tooltipStyle.contentStyle} itemStyle={tooltipStyle.itemStyle} labelStyle={tooltipStyle.labelStyle} formatter={(value) => [`${value}%`, 'Survival Rate']} />
              <Bar dataKey="rate" radius={[0, 2, 2, 0]}>
                {speciesSurvival.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 92 ? 'var(--accent)' : entry.rate >= 88 ? 'var(--warning)' : 'var(--danger)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
{/* Monthly Trend */}
        <div className="card p-4">
          <SectionLabel>Cumulative Monthly Trend</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="verified" name="Verified" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
              <Line type="monotone" dataKey="incidents" name="Incidents" stroke="var(--danger)" strokeWidth={2} dot={{ r: 3, fill: 'var(--danger)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Progress Tracker */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">Staff Submission Progress</h3>
          <div className="flex gap-2 text-xs">
            <select
              className="select text-xs"
              style={{ width: 'auto' }}
              value={staffType}
              onChange={e => { setStaffType(e.target.value); setStaffLimit(STAFF_PAGE_SIZE) }}
              aria-label="Filter by staff type"
            >
              <option value="all">All Staff Types</option>
              <option>Volunteer</option>
              <option>Staff</option>
              <option>Intern</option>
            </select>
            <input
              className="input text-xs"
              style={{ width: 150 }}
              placeholder="Search staff..."
              value={staffSearch}
              onChange={e => { setStaffSearch(e.target.value); setStaffLimit(STAFF_PAGE_SIZE) }}
              aria-label="Search staff"
            />
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Staff Type</th>
              <th className="num">Submissions</th>
              <th className="num">Approved</th>
              <th style={{ width: 160 }}>Approval</th>
              <th className="num">Rate</th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No staff match the current filters.
                </td>
              </tr>
            )}
            {visibleStaff.slice(0, staffLimit).map((s) => {
              const color = s.rate === 100 ? 'var(--accent)' : s.rate >= 60 ? 'var(--warning)' : 'var(--danger)'
              return (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium">{s.name}</div>
                    <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.id}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.staffType}</td>
                  <td className="num font-medium mono">{s.total}</td>
                  <td className="num font-medium mono">{s.approved}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: s.total }, (_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{ height: 8, background: i < s.approved ? color : 'var(--surface-muted)' }}
                          title={i < s.approved ? 'Approved' : 'Not approved'}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="num font-semibold mono" style={{ color }}>
                    {s.rate}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t text-xs flex items-center justify-between" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>Showing {Math.min(staffLimit, visibleStaff.length)} of {visibleStaff.length} staff members</span>
          {staffLimit < visibleStaff.length ? (
            <button className="btn btn-sm" onClick={() => setStaffLimit(l => l + STAFF_PAGE_SIZE)}>
              Load more →
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  )
}