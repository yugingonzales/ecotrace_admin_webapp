import { useEffect, useMemo, useState } from 'react'
import {
  usePortal,
  type SubStatus,
  type SubType,
  type Submission,
} from '../../lib/store'
import { useEscapeToClose, useScrollLock } from '../../lib/useEscapeToClose'

/** Rows per page. The table previously rendered a hard-coded "1 / 2" pager whose
 *  Prev/Next buttons did nothing at all. */
const PAGE_SIZE = 5

const statusStyle: Record<SubStatus, string> = {
  pending: 'badge-warning',
  approved: 'badge-accent',
  declined: 'badge-danger',
  resubmit: 'badge-info',
}

const statusLabel: Record<SubStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  resubmit: 'Re-submit',
}

const declineReasons = [
  'Inaccurate / Blurry Photo',
  'Out-of-Bounds GPS',
  'Duplicate Entry',
  'Missing Required Data',
  'Tag ID Mismatch',
  'Invalid Timestamp',
]

function DeclineModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (reason: string, note: string) => void }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  // Sits on top of the detail drawer, so Escape has to close this one first.
  useEscapeToClose(onClose)
  useScrollLock()

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Decline {count} Submission{count > 1 ? 's' : ''}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Select a standardized reason and optional feedback note</p>
          </div>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="field-label mb-2">Decline Reason *</label>
            <div className="space-y-1.5">
              {declineReasons.map(r => (
                <label key={r} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="decline-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    style={{ accentColor: 'var(--danger)' }}
                  />
                  <span className="text-xs">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Additional Note (optional)</label>
            <textarea
              className="textarea"
              style={{ minHeight: 72 }}
              placeholder="Add specific feedback for the staff member(s)..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn">Cancel</button>
          <button
            onClick={() => reason && onConfirm(reason, note)}
            className="btn btn-danger"
            style={{ cursor: reason ? 'pointer' : 'not-allowed', opacity: reason ? 1 : 0.6 }}
          >
            Decline {count} Submission{count > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
/**
 * Detail drawer. All three footer actions used to be inert `<button>`s; they now
 * call the same store reducers the batch bar uses, so a single approve writes
 * the same audit row, toast and notification a batch approve of one would.
 */
function DetailDrawer({
  sub,
  onClose,
  onApprove,
  onDecline,
  onResubmit,
}: {
  sub: Submission
  onClose: () => void
  onApprove: () => void
  onDecline: () => void
  onResubmit: () => void
}) {
  useEscapeToClose(onClose)
  useScrollLock()

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(16,24,40,0.25)' }} onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col" style={{ width: 460, background: '#fff', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 30px rgba(16,24,40,0.1)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="card-title">Submission {sub.id}</h2>
            <span className={`badge ${statusStyle[sub.status]}`}>{statusLabel[sub.status]}</span>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub.event}</div>
        </div>
        <button onClick={onClose} className="btn btn-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Staff Info */}
        <div className="rounded-lg p-3.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Staff</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span style={{ color: 'var(--text-muted)' }}>Name: </span><strong>{sub.staffName}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>ID: </span><span className="mono">{sub.staffId}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Type: </span><span>{sub.staffType}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Tree Tag: </span><span className="mono">{sub.treeTag}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Species: </span><em>{sub.species}</em></div>
          </div>
        </div>

        {/* Photo */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Verification Photo</div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <img src={sub.photo} alt="Tree verification photo" className="w-full object-cover" style={{ maxHeight: 200 }} />
          </div>
          <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ background: 'var(--text)', fontFamily: 'inherit' }}>
            <div style={{ color: 'var(--text-faint)', fontSize: 10, marginBottom: 4 }}>METADATA</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mono" style={{ color: '#fff', fontSize: 10 }}>
              <span>LAT: {sub.lat}° N</span>
              <span>LNG: {sub.lng}° E</span>
              <span>DATE: {sub.date}</span>
              <span>DEVICE: SM-A525F</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(sub.notes || sub.incidentType) && (
          <div className="rounded-lg p-3" style={{ background: sub.type === 'incident' ? 'var(--danger-soft)' : 'var(--surface-muted)', border: `1px solid ${sub.type === 'incident' ? 'rgba(220,58,58,0.3)' : 'var(--border)'}` }}>
            <div className="text-xs font-medium mb-1" style={{ color: sub.type === 'incident' ? 'var(--danger)' : 'var(--text-muted)' }}>
              {sub.type === 'incident' ? 'Incident Report' : 'Staff Notes'}
            </div>
            {sub.incidentType && <div className="text-xs font-medium mb-1" style={{ color: 'var(--danger)' }}>{sub.incidentType}</div>}
            {sub.notes && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub.notes}</div>}
          </div>
        )}
      </div>

        {sub.status === 'pending' && (
          <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onDecline} className="btn btn-sm flex-1" style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)' }}>Decline</button>
            <button onClick={onResubmit} className="btn btn-sm flex-1" style={{ background: 'var(--info-soft)', borderColor: 'transparent', color: 'var(--info)' }}>Request Re-submit</button>
            <button onClick={onApprove} className="btn btn-sm btn-primary flex-1">Approve ✓</button>
          </div>
        )}
      </div>
    </>
  )
}
export default function SubmissionsView() {
  const {
    submissions,
    storeActions,
    pendingCount,
    incidentCount,
    focus,
    clearFocus,
  } = usePortal()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | SubType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus>('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Which ids the decline dialog is about. Kept explicit rather than inferred
  // from `selected`, so the drawer's Decline button can never accidentally act
  // on an unrelated selection.
  const [declineTarget, setDeclineTarget] = useState<string[] | null>(null)
  // Stored as an id, never as the row object: after an action the row object in
  // the store is a new object, and a drawer holding the old one would keep
  // rendering the stale "Pending" badge and its action buttons.
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const drawerSub = drawerId ? (submissions.find(s => s.id === drawerId) ?? null) : null

  // Deep link from a notification or from the map: jump to the tree tag and open
  // its row, or apply the filter the notification was announcing, then release the
  // focus so a later store update does not re-open it. The effect keys on the
  // whole focus object, whose nonce makes a repeat click of the same
  // notification fire again instead of resolving to a no-op.
  useEffect(() => {
    if (!focus) return
    const { treeTag, status, type, event } = focus
    setPage(1)
    if (treeTag) {
      // A tree tag identifies one row, so any active filter has to go or the
      // drawer would open onto a list the row is not even in.
      setSearch('')
      setFilter('all')
      setStatusFilter('all')
      setEventFilter('all')
      const match = submissions.find(s => s.treeTag === treeTag)
      if (match) setDrawerId(match.id)
    } else {
      setDrawerId(null)
      if (type) setFilter(type)
      if (status) setStatusFilter(status)
      if (event) setEventFilter(event)
    }
    clearFocus()
  }, [focus, submissions, clearFocus])

  const eventNames = useMemo(
    () => [...new Set(submissions.map(s => s.event))].sort((a, b) => a.localeCompare(b)),
    [submissions],
  )

  const needle = search.trim().toLowerCase()

  const filtered = submissions.filter(s => {
    if (filter !== 'all' && s.type !== filter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (eventFilter !== 'all' && s.event !== eventFilter) return false
    if (needle && ![s.staffName, s.staffId, s.treeTag, s.species, s.id, s.event]
      .some(v => v.toLowerCase().includes(needle))) return false
    return true
  })

  // Any filter change invalidates the current page — a page 3 that no longer
  // exists would otherwise render an empty table.
  useEffect(() => { setPage(1) }, [filter, statusFilter, eventFilter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pendingSelected = Array.from(selected)
    .filter(id => submissions.find(s => s.id === id)?.status === 'pending')

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))

  const toggleAll = () => {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(s => s.id)))
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const batchApprove = () => {
    storeActions.approveSubmissions(pendingSelected)
    setSelected(new Set())
  }

  const batchDecline = (reason: string, note: string) => {
    if (!declineTarget) return
    storeActions.declineSubmissions(declineTarget, reason, note)
    setSelected(new Set())
    setDeclineTarget(null)
  }

  const batchResubmit = () => {
    storeActions.requestResubmit(pendingSelected)
    setSelected(new Set())
  }

  const singleApprove = () => drawerSub && storeActions.approveSubmissions([drawerSub.id])
  const singleResubmit = () => drawerSub && storeActions.requestResubmit([drawerSub.id])
  const singleDecline = () => {
    if (drawerSub) setDeclineTarget([drawerSub.id])
  }

  return (
    <div className="relative">
      {declineTarget && (
        <DeclineModal
          count={declineTarget.length}
          onClose={() => setDeclineTarget(null)}
          onConfirm={batchDecline}
        />
      )}

      {drawerSub && (
        <DetailDrawer
          sub={drawerSub}
          onClose={() => setDrawerId(null)}
          onApprove={singleApprove}
          onDecline={singleDecline}
          onResubmit={singleResubmit}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Submissions & Verification</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Batch-process staff tree planting and incident submissions</p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="mono">{pendingCount} pending</span>
          <span>·</span>
          <span>{incidentCount} incidents</span>
        </div>
      </div>
{/* Filters & Search */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" stroke="var(--text-muted)" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            className="input text-xs"
            style={{ paddingLeft: 30, background: '#fff' }}
            placeholder="Search by staff name, ID, tree tag, species..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--border)' }}>
          {([['all', 'All'], ['verification', 'Verifications'], ['incident', 'Incidents']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className="px-3 py-2 transition-colors"
              style={{ background: filter === v ? 'var(--accent)' : '#fff', color: filter === v ? 'white' : 'var(--text-muted)' }}
            >
              {l}
            </button>
          ))}
        </div>

        <select
          className="select text-xs"
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | SubStatus)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="resubmit">Re-submit</option>
        </select>

        <select
          className="select text-xs"
          style={{ width: 'auto' }}
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
          aria-label="Filter by event"
        >
          <option value="all">All Events</option>
          {eventNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {eventFilter !== 'all' && (
          <button className="btn btn-sm" onClick={() => setEventFilter('all')}>Clear event filter</button>
        )}

        {(needle || filter !== 'all' || statusFilter !== 'all' || eventFilter !== 'all') && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setSearch('')
              setFilter('all')
              setStatusFilter('all')
              setEventFilter('all')
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Batch Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-3 text-xs" style={{ background: 'var(--text)', color: 'white' }}>
          <span className="font-medium mono">{selected.size} selected</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{pendingSelected.length} pending (actionable)</span>
          <div className="flex-1" />
          <button
            onClick={batchApprove}
            disabled={pendingSelected.length === 0}
            className="btn btn-sm btn-primary"
          >
            ✓ Approve Selected ({pendingSelected.length})
          </button>
          <button
            onClick={() => pendingSelected.length > 0 && setDeclineTarget(pendingSelected)}
            disabled={pendingSelected.length === 0}
            className="btn btn-sm btn-danger"
          >
            ✕ Decline Selected ({pendingSelected.length})
          </button>
          <button
            onClick={batchResubmit}
            disabled={pendingSelected.length === 0}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
          >
            ↻ Request Re-submit ({pendingSelected.length})
          </button>
          <button onClick={() => setSelected(new Set())} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'transparent', color: 'rgba(255,255,255,0.7)' }}>
            Clear
          </button>
        </div>
      )}
{/* Table */}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <div
                  className="w-4 h-4 rounded border cursor-pointer flex items-center justify-center"
                  style={{
                    borderColor: 'var(--border)',
                    background: allFilteredSelected ? 'var(--accent)' : 'white',
                  }}
                  onClick={toggleAll}
                  role="checkbox"
                  aria-checked={allFilteredSelected}
                  aria-label="Select all filtered submissions"
                >
                  {allFilteredSelected && (
                    <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5" stroke="white" strokeWidth="2">
                      <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </th>
              <th>Submission</th>
              <th>Staff</th>
              <th>Species / Tag</th>
              <th>Event</th>
              <th>Coordinates</th>
              <th>Date</th>
              <th className="text-center">Type</th>
              <th className="text-center">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((sub) => {
              const isSelected = selected.has(sub.id)
              return (
                <tr
                  key={sub.id}
                  style={{ background: isSelected ? 'var(--accent-soft)' : sub.type === 'incident' && sub.status === 'pending' ? '#fffdf5' : '' }}
                >
                  <td>
                    <div
                      className="w-4 h-4 rounded border cursor-pointer flex items-center justify-center"
                      style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border)', background: isSelected ? 'var(--accent)' : 'white' }}
                      onClick={() => toggleOne(sub.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Select ${sub.id}`}
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOne(sub.id) } }}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5" stroke="white" strokeWidth="2">
                          <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--accent-dark)', fontSize: 11 }}>{sub.id}</span>
                  </td>
                  <td>
                    <div className="font-medium">{sub.staffName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sub.staffId} · {sub.staffType}</div>
                  </td>
                  <td>
                    <div className="italic" style={{ fontSize: 11 }}>{sub.species}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sub.treeTag}</div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: 140 }}>
                    <div className="truncate">{sub.event}</div>
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {sub.lat}° N<br />{sub.lng}° E
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sub.date}</td>
                  <td className="text-center">
                    {sub.type === 'incident' ? (
                      <span className="badge badge-danger">
                        {sub.incidentType ? sub.incidentType.split('/')[0].trim() : 'Incident'}
                      </span>
                    ) : (
                      <span className="badge badge-info">Verification</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${statusStyle[sub.status]}`}>{statusLabel[sub.status]}</span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => setDrawerId(sub.id)}
                      className="btn btn-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No submissions match your current filters.
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
            {'–'}
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} submissions
            {pageCount > 1 && <span className="ml-1">· page {safePage} of {pageCount}</span>}
          </span>
          <div className="flex items-center gap-1">
            <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous page">← Prev</button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className="btn btn-sm"
                onClick={() => setPage(p)}
                style={p === safePage ? { borderColor: 'var(--accent)', color: 'var(--accent-dark)' } : undefined}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </button>
            ))}
            <button className="btn btn-sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} aria-label="Next page">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}