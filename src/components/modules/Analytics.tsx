import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

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

const incidentTypes = [
  { name: 'Dead / Uprooted', value: 38, color: 'var(--danger)' },
  { name: 'Location Mismatch', value: 22, color: 'var(--warning)' },
  { name: 'Pest Infestation', value: 18, color: '#8b5cf6' },
  { name: 'Tag Misplacement', value: 14, color: 'var(--info)' },
  { name: 'Restricted Area', value: 8, color: '#ec4899' },
]

const staffProgress = [
  { name: 'Juan Santos', id: 'STF-001', staffType: 'Paid Volunteer', verified: 5, quota: 5, rate: 100 },
  { name: 'Ana Lim', id: 'STF-004', staffType: 'Staff', verified: 5, quota: 5, rate: 100 },
  { name: 'Marc Tan', id: 'STF-002', staffType: 'Intern', verified: 4, quota: 5, rate: 80 },
  { name: 'Sofia Torres', id: 'STF-006', staffType: 'Paid Volunteer', verified: 4, quota: 5, rate: 80 },
  { name: 'Carlo Diaz', id: 'STF-003', staffType: 'Staff', verified: 3, quota: 5, rate: 60 },
  { name: 'Rico Mendoza', id: 'STF-007', staffType: 'Intern', verified: 3, quota: 5, rate: 60 },
  { name: 'Lena Bautista', id: 'STF-008', staffType: 'Paid Volunteer', verified: 2, quota: 5, rate: 40 },
  { name: 'Kim Garcia', id: 'STF-009', staffType: 'Staff', verified: 1, quota: 5, rate: 20 },
]

const monthlyTrend = [
  { month: 'Jan', verified: 120, incidents: 5 },
  { month: 'Feb', verified: 280, incidents: 12 },
  { month: 'Mar', verified: 680, incidents: 28 },
  { month: 'Apr', verified: 1680, incidents: 12 },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
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
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Analytics & Progress</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>S.Y. 2025–2026 · Arbor Day Drive 2026 (active)</p>
        </div>
        <div className="flex gap-2 text-xs">
          <select className="select text-xs" style={{ width: 'auto' }}>
            <option>Arbor Day Drive 2026</option>
            <option>Earth Month Campaign</option>
          </select>
          <button className="btn btn-sm btn-primary">Export PDF ↓</button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Overall Survival Rate', value: '92.4%', sub: 'across 1,940 verified trees', color: 'var(--accent)' },
          { label: 'Avg. Quota Completion', value: '76.8%', sub: 'per staff member', color: 'var(--accent-dark)' },
          { label: 'Incident Rate', value: '2.4%', sub: 'of all submissions', color: 'var(--warning)' },
          { label: 'Batch Efficiency', value: '94.1%', sub: 'batch vs. single approvals', color: 'var(--info)' },
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
              <XAxis type="number" domain={[80, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
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
          <h3 className="card-title">Staff Quota Progress</h3>
          <div className="flex gap-2 text-xs">
            <select className="select text-xs" style={{ width: 'auto' }}>
              <option>All Staff Types</option>
              <option>Paid Volunteer</option>
              <option>Staff</option>
              <option>Intern</option>
            </select>
            <input className="input text-xs" style={{ width: 150 }} placeholder="Search staff..." />
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Staff Type</th>
              <th className="num">Progress</th>
              <th style={{ width: 160 }}>Quota Bar</th>
              <th className="num">Rate</th>
            </tr>
          </thead>
          <tbody>
            {staffProgress.map((s) => {
              const color = s.rate === 100 ? 'var(--accent)' : s.rate >= 60 ? 'var(--warning)' : 'var(--danger)'
              return (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium">{s.name}</div>
                    <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.id}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.staffType}</td>
                  <td className="num font-medium mono">
                    {s.verified}/{s.quota} trees
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: s.quota }, (_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{ height: 8, background: i < s.verified ? color : 'var(--surface-muted)' }}
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
        <div className="px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Showing 8 of 45 staff members · <span style={{ color: 'var(--accent-dark)', cursor: 'pointer' }}>Load more →</span>
        </div>
      </div>
    </div>
  )
}