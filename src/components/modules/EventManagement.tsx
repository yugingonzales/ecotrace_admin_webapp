import { useState } from 'react'
import EventBoundaryEditor from '../map/EventBoundaryEditor'
import type { Boundary } from '../../lib/site'

const events = [
  {
    id: 'E001',
    name: 'Arbor Day Drive 2026',
    year: '2025–2026',
    start: 'Apr 15, 2026',
    end: 'May 15, 2026',
    quota: 50,
    staff: 45,
    target: 2250,
    verified: 1680,
    pending: 38,
    incidents: 7,
    zone: 'Zone A – Main Campus',
    status: 'active',
  },
  {
    id: 'E002',
    name: 'Earth Month Campaign',
    year: '2025–2026',
    start: 'Apr 1, 2026',
    end: 'Apr 30, 2026',
    quota: 50,
    staff: 20,
    target: 1000,
    verified: 420,
    pending: 6,
    incidents: 3,
    zone: 'Zone B – Annex Field',
    status: 'active',
  },
  {
    id: 'E003',
    name: 'Campus Reforestation Q2',
    year: '2025–2026',
    start: 'May 1, 2026',
    end: 'Jun 30, 2026',
    quota: 50,
    staff: 15,
    target: 750,
    verified: 95,
    pending: 3,
    incidents: 2,
    zone: 'Zone C – Hillside Reserve',
    status: 'active',
  },
  {
    id: 'E004',
    name: 'Greening Initiative S1',
    year: '2024–2025',
    start: 'Sep 1, 2025',
    end: 'Oct 31, 2025',
    quota: 30,
    staff: 35,
    target: 1050,
    verified: 1020,
    pending: 0,
    incidents: 12,
    zone: 'Zone A – Main Campus',
status: 'completed',
  },
]

const statusStyle: Record<string, string> = {
  active: 'badge-accent',
  completed: 'badge-neutral',
  draft: 'badge-warning',
}
function CreateEventForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    year: '2025–2026',
    quota: '50',
    start: '',
    end: '',
    zone: '',
    boundary: [] as Boundary,
    guidelines: '',
    metrics: [] as string[],
  })

  const metricOptions = ['GPS Coordinates', 'Status Photo', 'Tree Height (cm)', 'Growth Stage', 'Diameter Measurement (cm)', 'Species Confirmation', 'Survival Status']

  const toggleMetric = (m: string) => {
    setForm(f => ({
      ...f,
      metrics: f.metrics.includes(m) ? f.metrics.filter(x => x !== m) : [...f.metrics, m],
    }))
  }

  const estStaff = form.year === '2025–2026' ? 45 : form.year === '2024–2025' ? 35 : 0
  const estTarget = estStaff * Number(form.quota || 0)

  const [mapExpanded, setMapExpanded] = useState(false)

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New Event</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure verification event details and staff assignment</p>
          </div>
          <button onClick={onClose} className="btn btn-sm">✕</button>
        </div>

        <div className="modal-body space-y-5">
          {/* Staff Cohort Indicator */}
          {estStaff > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(47,158,110,0.3)' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 mt-0.5 flex-shrink-0" stroke="var(--accent-dark)" strokeWidth="1.5">
                <circle cx="8" cy="8" r="7" />
                <path d="M5.5 8.5l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--accent-dark)' }}>
                <strong>{estStaff.toLocaleString()} active staff</strong> in S.Y. {form.year} will be automatically assigned.
                {estTarget > 0 && (
                  <> Total target: <strong>{estTarget.toLocaleString()} trees</strong> ({form.quota} × {estStaff.toLocaleString()}).</>
                )}
              </div>
            </div>
          )}
<div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="field-label">Event Title *</label>
              <input
                className="input"
                placeholder="e.g. Arbor Day Drive 2026"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="field-label">Description</label>
              <textarea
                className="textarea"
                placeholder="Briefly describe the event goals and context..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Academic Year Target *</label>
              <select
                className="select"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              >
                <option>2025–2026</option>
                <option>2024–2025</option>
                <option>2026–2027</option>
              </select>
            </div>

            <div>
              <label className="field-label">Quota per Staff *</label>
              <div className="relative">
                <input
                  type="number"
                  className="input"
                  value={form.quota}
                  min={1}
                  max={50}
                  onChange={e => setForm(f => ({ ...f, quota: e.target.value }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>trees/staff</span>
              </div>
            </div>

            <div>
              <label className="field-label">Start Date *</label>
              <input
                type="date"
                className="input"
                value={form.start}
                onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">End Date *</label>
              <input
                type="date"
                className="input"
                value={form.end}
                onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
              />
            </div>
<div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="field-label mb-0">Event Field Boundary / Zone</label>
                <select
                  className="select"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }}
                  value={form.zone}
                  onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                >
                  <option value="">Full campus map</option>
                  <option>Zone A – Main Campus</option>
                  <option>Zone B – Annex Field</option>
                  <option>Zone C – Hillside Reserve</option>
                </select>
              </div>

              <EventBoundaryEditor
                zoneLabel={form.zone}
                boundary={form.boundary}
                onChange={b => setForm(f => ({ ...f, boundary: b }))}
                height={250}
                expanded={mapExpanded}
                onExpand={() => setMapExpanded(true)}
                onClose={() => setMapExpanded(false)}
              />

              <div className="mt-2" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Boundary defines the area where staff verifications are accepted — draw at least 3 points to close it.
              </div>
            </div>

            <div className="col-span-2">
              <label className="field-label mb-2">Mandatory Metrics</label>
              <div className="flex flex-wrap gap-2">
                {metricOptions.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMetric(m)}
                    className="btn btn-sm"
                    style={{
                      borderColor: form.metrics.includes(m) ? 'var(--accent)' : 'var(--border)',
                      background: form.metrics.includes(m) ? 'var(--accent-soft)' : '#fff',
                      color: form.metrics.includes(m) ? 'var(--accent-dark)' : 'var(--text-muted)',
                    }}
                  >
                    {form.metrics.includes(m) ? '✓ ' : ''}{m}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="field-label">Event Guidelines</label>
              <textarea
                className="textarea"
                placeholder="Instructions staff will see when submitting verifications..."
                value={form.guidelines}
                onChange={e => setForm(f => ({ ...f, guidelines: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn">Cancel</button>
          <button className="btn">Save as Draft</button>
          <button className="btn btn-primary">Publish Event</button>
        </div>
      </div>
    </div>
  )
}
export default function EventManagement() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<typeof events[0] | null>(null)

  return (
    <div>
      {showCreate && <CreateEventForm onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Event Management</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create, configure, and monitor verification events</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <span>+</span> New Event
        </button>
      </div>

      {/* Selected Event Dashboard */}
      {selectedEvent && (
        <div className="card mb-5">
          <div className="card-header flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="card-title">{selectedEvent.name}</h2>
                <span className={`badge ${statusStyle[selectedEvent.status]}`}>{selectedEvent.status}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {selectedEvent.zone} · {selectedEvent.start} → {selectedEvent.end}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm">Extend Event</button>
              <button className="btn btn-sm">Reassign Quotas</button>
              <button className="btn btn-sm btn-primary">Export Log ↓</button>
              <button onClick={() => setSelectedEvent(null)} className="btn btn-sm">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-5 divide-x" style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Target Trees', value: selectedEvent.target.toLocaleString(), sub: `${selectedEvent.quota} / staff` },
              { label: 'Verified', value: selectedEvent.verified.toLocaleString(), sub: `${Math.round(selectedEvent.verified / selectedEvent.target * 100)}% complete`, color: 'var(--accent)' },
              { label: 'Active Staff', value: selectedEvent.staff.toLocaleString(), sub: `S.Y. ${selectedEvent.year}` },
              { label: 'Pending', value: selectedEvent.pending, sub: 'awaiting review', color: 'var(--warning)' },
              { label: 'Incidents', value: selectedEvent.incidents, sub: 'reports filed', color: 'var(--danger)' },
            ].map((s, i) => (
              <div key={i} className="px-5 py-3.5">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-xl font-semibold" style={{ color: s.color || 'var(--text)' }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="progress flex-1">
                <div style={{ width: `${Math.round(selectedEvent.verified / selectedEvent.target * 100)}%` }} />
              </div>
              <span className="text-xs font-medium mono" style={{ color: 'var(--text-muted)' }}>
                {Math.round(selectedEvent.verified / selectedEvent.target * 100)}% verified
              </span>
            </div>
          </div>
        </div>
      )}
{/* Events Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="card-title">All Events</h2>
          <div className="flex items-center gap-2">
            <select className="select" style={{ width: 'auto', padding: '5px 10px' }}>
              <option>All Years</option>
              <option>2025–2026</option>
              <option>2024–2025</option>
            </select>
            <select className="select" style={{ width: 'auto', padding: '5px 10px' }}>
              <option>All Status</option>
              <option>Active</option>
              <option>Completed</option>
              <option>Draft</option>
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>S.Y.</th>
              <th>Duration</th>
              <th className="num">Staff</th>
              <th className="num">Verified / Target</th>
              <th className="num">Incidents</th>
              <th className="text-center">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const pct = Math.round((ev.verified / ev.target) * 100)
              return (
                <tr
                  key={ev.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedEvent(ev)}
                >
                  <td>
                    <div className="font-medium">{ev.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{ev.id} · {ev.zone}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{ev.year}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {ev.start}<br />
                    <span style={{ color: 'var(--text-faint)' }}>→ {ev.end}</span>
                  </td>
                  <td className="num mono">{ev.staff.toLocaleString()}</td>
                  <td className="num">
                    <div className="mono">
                      {ev.verified.toLocaleString()} / {ev.target.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <div className="progress" style={{ width: 50 }}>
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{pct}%</span>
                    </div>
                  </td>
                  <td className="num">
                    <span className="mono" style={{ color: ev.incidents > 5 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {ev.incidents}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`badge ${statusStyle[ev.status]}`}>
                      {ev.status === 'active' ? 'Active' : ev.status === 'completed' ? 'Completed' : 'Draft'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="btn btn-sm">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}