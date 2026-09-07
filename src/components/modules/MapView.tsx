import { useState } from 'react'

interface TreeMarker {
  id: string
  x: number
  y: number
  status: 'verified' | 'pending' | 'incident' | 'unverified'
  studentName: string
  species: string
  datePlanted: string
  treeTag: string
  zone: string
}

const markers: TreeMarker[] = [
  { id: 'TRE-0892', x: 42, y: 38, status: 'verified', studentName: 'Juan Santos', species: 'Narra', datePlanted: 'Mar 12, 2026', treeTag: 'TRE-0892', zone: 'Zone A' },
  { id: 'TRE-0567', x: 55, y: 45, status: 'incident', studentName: 'Maria Reyes', species: 'Molave', datePlanted: 'Mar 15, 2026', treeTag: 'TRE-0567', zone: 'Zone A' },
  { id: 'TRE-1204', x: 38, y: 52, status: 'pending', studentName: 'Carlo Diaz', species: 'Ipil', datePlanted: 'Mar 18, 2026', treeTag: 'TRE-1204', zone: 'Zone A' },
  { id: 'TRE-0341', x: 65, y: 33, status: 'verified', studentName: 'Ana Lim', species: 'Mahogany', datePlanted: 'Mar 20, 2026', treeTag: 'TRE-0341', zone: 'Zone A' },
  { id: 'TRE-0783', x: 72, y: 58, status: 'incident', studentName: 'Ben Cruz', species: 'Banaba', datePlanted: 'Mar 22, 2026', treeTag: 'TRE-0783', zone: 'Zone B' },
  { id: 'TRE-1108', x: 48, y: 65, status: 'pending', studentName: 'Sofia Torres', species: 'Kamagong', datePlanted: 'Mar 25, 2026', treeTag: 'TRE-1108', zone: 'Zone A' },
  { id: 'TRE-0223', x: 30, y: 44, status: 'verified', studentName: 'Rico Mendoza', species: 'Narra', datePlanted: 'Mar 28, 2026', treeTag: 'TRE-0223', zone: 'Zone A' },
  { id: 'TRE-0950', x: 60, y: 72, status: 'incident', studentName: 'Lena Bautista', species: 'Molave', datePlanted: 'Apr 1, 2026', treeTag: 'TRE-0950', zone: 'Zone B' },
  { id: 'TRE-0412', x: 25, y: 30, status: 'verified', studentName: 'Marc Tan', species: 'Ipil', datePlanted: 'Apr 3, 2026', treeTag: 'TRE-0412', zone: 'Zone A' },
  { id: 'TRE-1056', x: 80, y: 42, status: 'unverified', studentName: 'Donna Uy', species: 'Narra', datePlanted: 'Apr 5, 2026', treeTag: 'TRE-1056', zone: 'Zone B' },
  { id: 'TRE-0678', x: 35, y: 70, status: 'unverified', studentName: 'Kai Lopez', species: 'Mahogany', datePlanted: 'Apr 7, 2026', treeTag: 'TRE-0678', zone: 'Zone A' },
  { id: 'TRE-0199', x: 52, y: 28, status: 'verified', studentName: 'Jess Flores', species: 'Banaba', datePlanted: 'Apr 9, 2026', treeTag: 'TRE-0199', zone: 'Zone A' },
  { id: 'TRE-0834', x: 68, y: 48, status: 'pending', studentName: 'Chris Ramos', species: 'Narra', datePlanted: 'Apr 11, 2026', treeTag: 'TRE-0834', zone: 'Zone B' },
  { id: 'TRE-0455', x: 44, y: 80, status: 'verified', studentName: 'Pat Soriano', species: 'Kamagong', datePlanted: 'Apr 13, 2026', treeTag: 'TRE-0455', zone: 'Zone A' },
  { id: 'TRE-1320', x: 22, y: 58, status: 'pending', studentName: 'Kim Garcia', species: 'Ipil', datePlanted: 'Apr 15, 2026', treeTag: 'TRE-1320', zone: 'Zone A' },
]

const statusConfig = {
  verified: { color: 'var(--accent)', label: 'Verified & Healthy', stroke: 'var(--accent-dark)' },
  pending: { color: 'var(--warning)', label: 'Pending Verification', stroke: '#b06e16' },
  incident: { color: 'var(--danger)', label: 'Incident / Declined', stroke: '#b02a2a' },
  unverified: { color: '#9aa1a9', label: 'Unverified / Missing', stroke: '#6b7280' },
}

const counts = {
  verified: markers.filter(m => m.status === 'verified').length,
  pending: markers.filter(m => m.status === 'pending').length,
  incident: markers.filter(m => m.status === 'incident').length,
  unverified: markers.filter(m => m.status === 'unverified').length,
}
export default function MapView() {
  const [activeMarker, setActiveMarker] = useState<TreeMarker | null>(null)
  const [activeLayer, setActiveLayer] = useState<'all' | keyof typeof statusConfig>('all')
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })

  const visibleMarkers = activeLayer === 'all' ? markers : markers.filter(m => m.status === activeLayer)

  const handleMarkerClick = (m: TreeMarker, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMarker(m)
    setPopupPos({ x: m.x, y: m.y })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Map View</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Spatial monitoring — {markers.length} trees across active zones</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select className="select text-xs" style={{ width: 'auto' }}>
            <option>Arbor Day Drive 2026</option>
            <option>Earth Month Campaign</option>
            <option>Campus Reforestation Q2</option>
          </select>
          <select className="select text-xs" style={{ width: 'auto' }}>
            <option>All Zones</option>
            <option>Zone A – Main Campus</option>
            <option>Zone B – Annex Field</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 280px' }}>
        {/* Map */}
        <div className="card overflow-hidden relative" style={{ minHeight: 520 }}>
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full absolute inset-0"
            preserveAspectRatio="xMidYMid slice"
            onClick={() => setActiveMarker(null)}
            style={{ cursor: 'crosshair' }}
          >
            <rect width="100" height="100" fill="#eef2f0" />

            <polygon
              points="20,20 70,18 68,72 18,75"
              fill="rgba(47,158,110,0.08)"
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="2 1.5"
            />
            <text x="21" y="27" fontSize="3" fill="var(--text-faint)">ZONE A – MAIN CAMPUS</text>

            <polygon
              points="72,40 92,38 90,85 70,82"
              fill="rgba(47,110,158,0.06)"
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="2 1.5"
            />
            <text x="73" y="46" fontSize="2.5" fill="var(--text-faint)">ZONE B</text>

            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
              <g key={v}>
                <line x1={v} y1="0" x2={v} y2="100" stroke="rgba(28,33,40,0.05)" strokeWidth="0.3" />
                <line x1="0" y1={v} x2="100" y2={v} stroke="rgba(28,33,40,0.05)" strokeWidth="0.3" />
              </g>
            ))}

            <path d="M20,50 Q50,45 80,55" stroke="rgba(28,33,40,0.08)" strokeWidth="1.5" fill="none" />
            <path d="M50,20 Q52,50 48,80" stroke="rgba(28,33,40,0.06)" strokeWidth="1" fill="none" />

            {/* Markers */}
            {visibleMarkers.map((m) => {
              const cfg = statusConfig[m.status]
              const isActive = activeMarker?.id === m.id
              return (
                <g
                  key={m.id}
                  transform={`translate(${m.x}, ${m.y})`}
                  onClick={(e) => handleMarkerClick(m, e as unknown as React.MouseEvent)}
                  style={{ cursor: 'pointer' }}
                >
                  {isActive && (
                    <circle cx="0" cy="0" r="4.5" fill={cfg.color} opacity="0.25" />
                  )}
                  <circle cx="0" cy="0" r="2.2" fill={cfg.color} stroke={isActive ? '#fff' : cfg.stroke} strokeWidth={isActive ? 0.8 : 0.4} />
                  {m.status === 'incident' && (
                    <text x="0" y="0.8" textAnchor="middle" fontSize="2" fill="white" fontWeight="bold">!</text>
                  )}
                </g>
              )
            })}

            {/* Popup */}
            {activeMarker && (() => {
              const px = popupPos.x > 65 ? popupPos.x - 32 : popupPos.x + 4
              const py = popupPos.y > 65 ? popupPos.y - 24 : popupPos.y + 4
              return (
                <g transform={`translate(${px}, ${py})`}>
                  <rect x="0" y="0" width="30" height="18" rx="1.5" fill="var(--text)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
                  <text x="2" y="4" fontSize="2.2" fill="var(--accent)">{activeMarker.treeTag}</text>
                  <text x="2" y="7.5" fontSize="2" fill="rgba(255,255,255,0.85)">{activeMarker.studentName}</text>
                  <text x="2" y="10.5" fontSize="1.9" fill="rgba(255,255,255,0.5)" fontStyle="italic">{activeMarker.species}</text>
                  <text x="2" y="13.5" fontSize="1.8" fill="rgba(255,255,255,0.4)">Planted: {activeMarker.datePlanted}</text>
                </g>
              )
            })()}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-10 card px-3 py-2.5" style={{ boxShadow: '0 4px 12px rgba(16,24,40,0.1)' }}>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(activeLayer === key ? 'all' : key as keyof typeof statusConfig); setActiveMarker(null) }}
                  className="flex items-center gap-1.5"
                  style={{ color: activeLayer === key ? cfg.color : 'var(--text-muted)', fontWeight: activeLayer === key ? 600 : 400 }}
                >
                  <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: cfg.color }} />
                  {counts[key as keyof typeof counts]} {cfg.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
{/* Right column */}
        <div className="space-y-4">
          {/* Active marker details */}
          {activeMarker ? (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium">{activeMarker.treeTag}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeMarker.zone}</div>
                </div>
                <span className="badge" style={{ background: `${statusConfig[activeMarker.status].color}22`, color: statusConfig[activeMarker.status].color }}>
                  {statusConfig[activeMarker.status].label.split(' ')[0]}
                </span>
              </div>
              <div className="text-xs space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Student</span>
                  <span className="font-medium">{activeMarker.studentName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Species</span>
                  <span className="italic">{activeMarker.species}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Planted</span>
                  <span>{activeMarker.datePlanted}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-sm flex-1">View Submission</button>
                {activeMarker.status === 'pending' && (
                  <button className="btn btn-sm btn-primary flex-1">Approve</button>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-4 text-center" style={{ background: 'var(--surface-muted)', borderStyle: 'dashed' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Click any marker on the map to view tree details</div>
            </div>
          )}

          {/* Zone Stats */}
          <div className="card p-4">
            <h3 className="card-title mb-3">Zone Summary</h3>
            {[
              { zone: 'Zone A – Main Campus', trees: 11, verified: 7, incidents: 1 },
              { zone: 'Zone B – Annex Field', trees: 4, verified: 0, incidents: 2 },
            ].map(z => (
              <div key={z.zone} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">{z.zone}</span>
                  <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{z.trees} trees</span>
                </div>
                <div className="progress">
                  <div style={{ width: `${(z.verified / z.trees) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  <span>{z.verified} verified</span>
                  {z.incidents > 0 && <span style={{ color: 'var(--danger)' }}>{z.incidents} incident{z.incidents > 1 ? 's' : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}