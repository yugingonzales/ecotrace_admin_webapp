import { useMemo, useState } from 'react'
import EventBoundaryEditor from '../map/EventBoundaryEditor'
import type { Boundary } from '../../lib/site'
import { treesEligibleForVerification } from '../../lib/trees'
import { usePlants } from '../../lib/usePlants'
import { eventProgress, usePortal, type EventDraft, type PortalEvent } from '../../lib/store'
import { useEscapeToClose, useScrollLock } from '../../lib/useEscapeToClose'
import { downloadCsv } from '../../lib/csv'

// Events now live in the shared store (`lib/store.tsx`) so Create, Extend and
// Reassign Quotas can mutate them. This module only reads.

const statusStyle: Record<string, string> = {
  active: 'badge-accent',
  completed: 'badge-neutral',
  draft: 'badge-warning',
}

/**
 * Module scope, not component scope: the list is a constant, and "Select all"
 * can only be correct if it is the *same* list the chips are rendered from.
 * Rebuilding it per render would have made `metrics.length === options.length`
 * compare against a fresh identity every time.
 */
const METRIC_OPTIONS = [
  'GPS Coordinates',
  'Status Photo',
  'Tree Height (cm)',
  'Growth Stage',
  'Diameter Measurement (cm)',
  'Survival Status',
] as const

function CreateEventForm({ onClose }: { onClose: () => void }) {
  const { storeActions } = usePortal()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    plantFrom: '',
    plantTo: '',
    quota: '50',
    start: '',
    end: '',
    zone: '',
    boundary: [] as Boundary,
    guidelines: '',
    metrics: [] as string[],
  })

  const toggleMetric = (m: string) => {
    setForm(f => ({
      ...f,
      metrics: f.metrics.includes(m) ? f.metrics.filter(x => x !== m) : [...f.metrics, m],
    }))
  }

  // "Select all" / "Clear all" as a single toggle, so there is only ever one
  // control to aim at regardless of the current selection. The chips stay
  // individually clickable for the common case of a couple of exceptions.
  const allMetricsSelected = form.metrics.length === METRIC_OPTIONS.length
  const toggleAllMetrics = () => {
    setForm(f => ({
      ...f,
      metrics: allMetricsSelected ? [] : [...METRIC_OPTIONS],
    }))
  }

  // Fed from the same source as the map so the eligible-tree count never
  // contradicts the pins drawn beside it.
  const { markers } = usePlants()

  const eligibleTrees = useMemo(
    () => treesEligibleForVerification(form.boundary, form.plantFrom, form.plantTo, markers),
    [form.boundary, form.plantFrom, form.plantTo, markers],
  )

  const [mapExpanded, setMapExpanded] = useState(false)

  useEscapeToClose(onClose)
  useScrollLock()

  /** One validator for both footer buttons, so Save-draft and Publish cannot
   *  disagree about what a valid event is. */
  const submit = (publish: boolean) => {
    if (!form.title.trim()) return setError('Event name is required.')
    if (!form.start) return setError('Start date is required.')
    if (!form.end) return setError('End date is required.')
    if (form.end < form.start) return setError('End date must be on or after the start date.')
    const quota = Number(form.quota)
    if (!Number.isFinite(quota) || quota < 1 || quota > 50) {
      return setError('Quota must be between 1 and 50 trees per staff member.')
    }
    // The field is labelled "Mandatory" and staff read it as the list of
    // parameters they must submit against, so a published event with none would
    // be a promise the portal does not keep. Drafts stay permissive — that is
    // the point of a draft.
    if (publish && form.metrics.length === 0) {
      return setError('Select at least one mandatory metric before publishing.')
    }
    setError(null)

    const draft: EventDraft = {
      title: form.title,
      description: form.description,
      plantFrom: form.plantFrom,
      plantTo: form.plantTo,
      quota: form.quota,
      start: form.start,
      end: form.end,
      zone: form.zone,
      boundary: form.boundary,
      guidelines: form.guidelines,
      metrics: form.metrics,
    }
    storeActions.createEvent(draft, publish)
    onClose()
  }

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
          {/* Eligible Trees Indicator */}
          {form.plantFrom && form.plantTo && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(47,158,110,0.3)' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 mt-0.5 flex-shrink-0" stroke="var(--accent-dark)" strokeWidth="1.5">
                <circle cx="8" cy="8" r="7" />
                <path d="M5.5 8.5l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--accent-dark)' }}>
                <strong>{eligibleTrees.length} existing tree{eligibleTrees.length !== 1 ? 's' : ''}</strong> planted between{' '}
                {new Date(form.plantFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} –{' '}
                {new Date(form.plantTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {form.boundary.length >= 3
                  ? ' inside the drawn boundary are eligible for verification.'
                  : ' are within the selected period. Draw a boundary to narrow results.'}
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
              <label className="field-label">Tree Planting Period *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Planted From</label>
                  <input
                    type="date"
                    className="input"
                    value={form.plantFrom}
                    onChange={e => setForm(f => ({ ...f, plantFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Planted To</label>
                  <input
                    type="date"
                    className="input"
                    value={form.plantTo}
                    onChange={e => setForm(f => ({ ...f, plantTo: e.target.value }))}
                  />
                </div>
              </div>
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
{/* Eligible Trees Preview */}
              {form.plantFrom && form.plantTo && (
                <div className="mt-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-xs font-medium">
                      Trees to verify ({eligibleTrees.length})
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      inside boundary · planted in period
                    </span>
                  </div>
                  {eligibleTrees.length === 0 ? (
                    <div className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      No trees match the current boundary and planting period.
                      {form.boundary.length < 3 && ' Draw at least 3 boundary points to filter.'}
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto px-1 py-1">
                      {eligibleTrees.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                        >
                          <span
                            className="inline-block rounded-full flex-shrink-0"
                            style={{
                              width: 8,
                              height: 8,
                              background:
                                t.status === 'verified' ? 'var(--accent)'
                                  : t.status === 'pending' ? 'var(--warning)'
                                    : t.status === 'incident' ? 'var(--danger)'
                                      : 'var(--text-faint)',
                            }}
                          />
                          <span className="mono font-medium">{t.treeTag}</span>
                          <span className="italic flex-1 truncate">{t.species}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{t.datePlanted}</span>
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{t.zone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="field-label mb-0">
                  Mandatory Metrics
                  <span className="ml-2 font-normal" style={{ color: 'var(--text-faint)' }}>
                    {form.metrics.length} of {METRIC_OPTIONS.length} selected
                  </span>
                </label>
                <button
                  type="button"
                  onClick={toggleAllMetrics}
                  className="btn btn-sm"
                  style={{ color: 'var(--accent-dark)', borderColor: 'var(--accent)' }}
                  aria-pressed={allMetricsSelected}
                >
                  {allMetricsSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Mandatory verification metrics"
              >
                {METRIC_OPTIONS.map(m => {
                  const on = form.metrics.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMetric(m)}
                      className="btn btn-sm"
                      aria-pressed={on}
                      style={{
                        borderColor: on ? 'var(--accent)' : 'var(--border)',
                        background: on ? 'var(--accent-soft)' : '#fff',
                        color: on ? 'var(--accent-dark)' : 'var(--text-muted)',
                      }}
                    >
                      {on ? '✓ ' : ''}{m}
                    </button>
                  )
                })}
              </div>

              {form.metrics.length === 0 && (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  No metrics selected. A draft can be saved without any; publishing requires at least one.
                </p>
              )}
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

        {error && (
          <div
            className="mx-5 mt-3 flex items-start gap-2 px-3 py-2.5 rounded text-xs"
            style={{ background: 'var(--danger-soft)', border: '1px solid rgba(220,58,58,0.3)', color: 'var(--danger)' }}
            role="alert"
          >
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={() => submit(false)} className="btn">Save as Draft</button>
          <button onClick={() => submit(true)} className="btn btn-primary">Publish Event</button>
        </div>
      </div>
    </div>
  )
}
export default function EventManagement() {
  const { events, storeActions } = usePortal()
  const [showCreate, setShowCreate] = useState(false)
  // Held as an id so the dashboard always renders the live row: after Extend
  // Quotas the old object would still show the pre-action end date.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [quotaDraft, setQuotaDraft] = useState<{ id: string; value: string } | null>(null)

  const selectedEvent = selectedId ? (events.find(e => e.id === selectedId) ?? null) : null

  const years = useMemo(
    () => [...new Set(events.map(e => e.year))].sort((a, b) => b.localeCompare(a)),
    [events],
  )

  const visibleEvents = events.filter(e => {
    if (yearFilter !== 'all' && e.year !== yearFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    return true
  })

  const exportLog = (ev: PortalEvent) => {
    const n = downloadCsv(
      `ecotrace_event_${ev.id}_log.csv`,
      ['Event', 'Event ID', 'S.Y.', 'Zone', 'Start', 'End', 'Quota / staff', 'Staff', 'Target', 'Verified', 'Pending', 'Incidents', 'Status'],
      [[ev.name, ev.id, ev.year, ev.zone, ev.start, ev.end, ev.quota, ev.staff, ev.target, ev.verified, ev.pending, ev.incidents, ev.status]],
    )
    storeActions.recordExport(`Exported ${ev.name} (${ev.id}) summary (CSV)`, n)
  }

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
            <div className="flex gap-2 items-start">
              {quotaDraft && quotaDraft.id === selectedEvent.id ? (
                <>
                  <input
                    className="input text-xs"
                    style={{ width: 70 }}
                    type="number"
                    min={1}
                    max={50}
                    value={quotaDraft.value}
                    autoFocus
                    aria-label="New quota per staff member"
                    onChange={e => setQuotaDraft({ ...quotaDraft, value: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        storeActions.reassignQuotas(selectedEvent.id, Number(quotaDraft.value))
                        setQuotaDraft(null)
                      }
                      if (e.key === 'Escape') setQuotaDraft(null)
                    }}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      storeActions.reassignQuotas(selectedEvent.id, Number(quotaDraft.value))
                      setQuotaDraft(null)
                    }}
                  >
                    Apply
                  </button>
                  <button className="btn btn-sm" onClick={() => setQuotaDraft(null)}>Cancel</button>
                </>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => setQuotaDraft({ id: selectedEvent.id, value: String(selectedEvent.quota) })}
                  title="Set a new trees-per-staff quota for this event"
                >
                  Reassign Quotas
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => storeActions.extendEvent(selectedEvent.id, 7)}
                title="Move the end date out by 7 days"
              >
                Extend +7 days
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => exportLog(selectedEvent)}>
                Export Log ↓
              </button>
              <button onClick={() => setSelectedId(null)} className="btn btn-sm" aria-label="Close event dashboard">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-5 divide-x" style={{ borderBottom: '1px solid var(--border)' }}>
            {(() => {
              // A brand-new event has no staff assigned yet, so there is no
              // meaningful completion figure. Show '—' rather than inventing 0%.
              const pct = eventProgress(selectedEvent)
              return [
                {
                  label: 'Target Trees',
                  value: selectedEvent.target > 0 ? selectedEvent.target.toLocaleString() : '—',
                  sub: `${selectedEvent.quota} / staff`,
                },
                {
                  label: 'Verified',
                  value: selectedEvent.verified.toLocaleString(),
                  sub: pct === null ? 'awaiting staff assignment' : `${pct}% complete`,
                  color: 'var(--accent)',
                },
                {
                  label: 'Active Staff',
                  value: selectedEvent.staff > 0 ? selectedEvent.staff.toLocaleString() : '—',
                  sub: `S.Y. ${selectedEvent.year}`,
                },
                { label: 'Pending', value: selectedEvent.pending, sub: 'awaiting review', color: 'var(--warning)' },
                { label: 'Incidents', value: selectedEvent.incidents, sub: 'reports filed', color: 'var(--danger)' },
              ].map((s, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  <div className="text-xl font-semibold" style={{ color: s.color || 'var(--text)' }}>{s.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
                </div>
              ))
            })()}
          </div>
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="progress flex-1">
                <div style={{ width: `${eventProgress(selectedEvent) ?? 0}%` }} />
              </div>
              <span className="text-xs font-medium mono" style={{ color: 'var(--text-muted)' }}>
                {eventProgress(selectedEvent) === null ? 'No target set' : `${eventProgress(selectedEvent)}% verified`}
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
            <select
              className="select"
              style={{ width: 'auto', padding: '5px 10px' }}
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              aria-label="Filter by school year"
            >
              <option value="all">All Years</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 'auto', padding: '5px 10px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
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
            {visibleEvents.map((ev) => {
              const pct = eventProgress(ev)
              return (
                <tr
                  key={ev.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(ev.id)}
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
                      {ev.verified.toLocaleString()} / {ev.target > 0 ? ev.target.toLocaleString() : '—'}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <div className="progress" style={{ width: 50 }}>
                        <div style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{pct === null ? '—' : `${pct}%`}</span>
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
                    <button
                      className="btn btn-sm"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedId(ev.id)
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visibleEvents.length === 0 && (
          <div className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No events match the current year and status filters.
          </div>
        )}
      </div>
    </div>
  )
}
