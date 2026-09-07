import { useState } from 'react'

type SubType = 'verification' | 'incident'
type SubStatus = 'pending' | 'approved' | 'declined' | 'resubmit'

interface Submission {
  id: string
  studentName: string
  studentId: string
  treeTag: string
  species: string
  type: SubType
  status: SubStatus
  event: string
  date: string
  lat: string
  lng: string
  photo: string
  incidentType?: string
  notes?: string
}

const SUBMISSIONS: Submission[] = [
  { id: 'SUB-4421', studentName: 'Juan Santos', studentId: '2023-00142', treeTag: 'TRE-0892', species: 'Narra (Pterocarpus indicus)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 28, 2026 09:14', lat: '14.6591', lng: '121.0437', photo: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=200&fit=crop&auto=format', notes: 'Tree is healthy, new growth visible.' },
  { id: 'SUB-4420', studentName: 'Maria Reyes', studentId: '2023-00387', treeTag: 'TRE-0567', species: 'Molave (Vitex parviflora)', type: 'incident', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 28, 2026 08:58', lat: '14.6588', lng: '121.0441', photo: 'https://images.unsplash.com/photo-1503785640985-f62e3aeee448?w=300&h=200&fit=crop&auto=format', incidentType: 'Dead / Uprooted Tree', notes: 'Tree has been uprooted, possibly by recent storm.' },
  { id: 'SUB-4419', studentName: 'Carlo Diaz', studentId: '2022-10058', treeTag: 'TRE-1204', species: 'Ipil (Intsia bijuga)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 16:31', lat: '14.6594', lng: '121.0429', photo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4418', studentName: 'Ana Lim', studentId: '2024-00091', treeTag: 'TRE-0341', species: 'Mahogany (Swietenia macrophylla)', type: 'verification', status: 'approved', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 14:05', lat: '14.6579', lng: '121.0452', photo: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4417', studentName: 'Ben Cruz', studentId: '2022-00234', treeTag: 'TRE-0783', species: 'Banaba (Lagerstroemia speciosa)', type: 'incident', status: 'declined', event: 'Earth Month Campaign', date: 'Apr 27, 2026 11:22', lat: '14.6601', lng: '121.0415', photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop&auto=format', incidentType: 'Location Mismatch' },
  { id: 'SUB-4416', studentName: 'Sofia Torres', studentId: '2023-00519', treeTag: 'TRE-1108', species: 'Kamagong (Diospyros blancoi)', type: 'verification', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 27, 2026 10:44', lat: '14.6585', lng: '121.0460', photo: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4415', studentName: 'Rico Mendoza', studentId: '2021-00772', treeTag: 'TRE-0223', species: 'Narra (Pterocarpus indicus)', type: 'verification', status: 'pending', event: 'Campus Reforestation Q2', date: 'Apr 26, 2026 15:18', lat: '14.6577', lng: '121.0445', photo: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=200&fit=crop&auto=format' },
  { id: 'SUB-4414', studentName: 'Lena Bautista', studentId: '2023-00816', treeTag: 'TRE-0950', species: 'Molave (Vitex parviflora)', type: 'incident', status: 'pending', event: 'Arbor Day Drive 2026', date: 'Apr 26, 2026 09:33', lat: '14.6596', lng: '121.0432', photo: 'https://images.unsplash.com/photo-1503785640985-f62e3aeee448?w=300&h=200&fit=crop&auto=format', incidentType: 'Pest Infestation' },
]
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
              placeholder="Add specific feedback for the student(s)..."
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
function DetailDrawer({ sub, onClose }: { sub: Submission; onClose: () => void }) {
  return (
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
        {/* Student Info */}
        <div className="rounded-lg p-3.5" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Student</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span style={{ color: 'var(--text-muted)' }}>Name: </span><strong>{sub.studentName}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>ID: </span><span className="mono">{sub.studentId}</span></div>
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
              {sub.type === 'incident' ? 'Incident Report' : 'Student Notes'}
            </div>
            {sub.incidentType && <div className="text-xs font-medium mb-1" style={{ color: 'var(--danger)' }}>{sub.incidentType}</div>}
            {sub.notes && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub.notes}</div>}
          </div>
        )}
      </div>

      {sub.status === 'pending' && (
        <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button className="btn btn-sm flex-1" style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)' }}>Decline</button>
          <button className="btn btn-sm flex-1" style={{ background: 'var(--info-soft)', borderColor: 'transparent', color: 'var(--info)' }}>Request Re-submit</button>
          <button className="btn btn-sm btn-primary flex-1">Approve ✓</button>
        </div>
      )}
    </div>
  )
}
export default function SubmissionsView() {
  const [subs, setSubs] = useState<Submission[]>(SUBMISSIONS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | SubType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus>('all')
  const [search, setSearch] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [drawerSub, setDrawerSub] = useState<Submission | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = subs.filter(s => {
    if (filter !== 'all' && s.type !== filter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search && ![s.studentName, s.studentId, s.treeTag, s.species].some(v => v.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  const pendingSelected = [...selected].filter(id => subs.find(s => s.id === id)?.status === 'pending')

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  const batchApprove = () => {
    setSubs(prev => prev.map(s => selected.has(s.id) && s.status === 'pending' ? { ...s, status: 'approved' } : s))
    showToast(`Approved ${pendingSelected.length} submission${pendingSelected.length > 1 ? 's' : ''}`)
    setSelected(new Set())
  }

  const batchDecline = (reason: string, note: string) => {
    setSubs(prev => prev.map(s => selected.has(s.id) && s.status === 'pending' ? { ...s, status: 'declined', notes: `[${reason}] ${note}` } : s))
    showToast(`Declined ${pendingSelected.length} submission${pendingSelected.length > 1 ? 's' : ''}`, 'error')
    setSelected(new Set())
    setShowDecline(false)
  }

  const batchResubmit = () => {
    setSubs(prev => prev.map(s => selected.has(s.id) && s.status === 'pending' ? { ...s, status: 'resubmit' } : s))
    showToast(`Requested re-submission for ${pendingSelected.length} item${pendingSelected.length > 1 ? 's' : ''}`)
    setSelected(new Set())
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 text-xs px-4 py-3 rounded-lg"
          style={{ background: toast.type === 'success' ? 'var(--accent-dark)' : 'var(--danger)', color: 'white', boxShadow: '0 8px 24px rgba(16,24,40,0.15)' }}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {showDecline && (
        <DeclineModal
          count={pendingSelected.length}
          onClose={() => setShowDecline(false)}
          onConfirm={batchDecline}
        />
      )}

      {drawerSub && <DetailDrawer sub={drawerSub} onClose={() => setDrawerSub(null)} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Submissions & Verification</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Batch-process student tree planting and incident submissions</p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="mono">{subs.filter(s => s.status === 'pending').length} pending</span>
          <span>·</span>
          <span>{subs.filter(s => s.type === 'incident').length} incidents</span>
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
            placeholder="Search by student name, ID, tree tag, species..."
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

        <select className="select text-xs" style={{ width: 'auto' }}>
          <option>All Events</option>
          <option>Arbor Day Drive 2026</option>
          <option>Earth Month Campaign</option>
          <option>Campus Reforestation Q2</option>
        </select>
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
            onClick={() => pendingSelected.length > 0 && setShowDecline(true)}
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
                    background: selected.size === filtered.length && filtered.length > 0 ? 'var(--accent)' : 'white',
                  }}
                  onClick={toggleAll}
                >
                  {selected.size === filtered.length && filtered.length > 0 && (
                    <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5" stroke="white" strokeWidth="2">
                      <path d="M2 5l2.5 2.5L8 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </th>
              <th>Submission</th>
              <th>Student</th>
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
            {filtered.map((sub) => {
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
                      onClick={() => {
                        const n = new Set(selected)
                        if (n.has(sub.id)) n.delete(sub.id)
                        else n.add(sub.id)
                        setSelected(n)
                      }}
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
                    <div className="font-medium">{sub.studentName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sub.studentId}</div>
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
                      onClick={() => setDrawerSub(sub)}
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
          <span>Showing {filtered.length} of {subs.length} submissions</span>
          <div className="flex items-center gap-1">
            <button className="btn btn-sm">← Prev</button>
            <button className="btn btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent-dark)' }}>1</button>
            <button className="btn btn-sm">2</button>
            <button className="btn btn-sm">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}