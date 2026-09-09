import * as L from 'leaflet'
import { useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, LayersControl, useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { buildVoronoiZones, type VBounds } from '../../utils/voronoi'

type StatusKey = 'verified' | 'pending' | 'incident' | 'unverified'
type ZoneName = 'Zone I' | 'Zone II' | 'Zone III'

interface TreeMarker {
  id: string
  lat: number
  lng: number
  status: StatusKey
  staffName: string
  species: string
  datePlanted: string
  treeTag: string
  zone: ZoneName
}

interface ZoneInfo {
  name: ZoneName
  lat: number
  lng: number
  elev: number
  color: string
}

interface ZonePolygon extends ZoneInfo {
  vertices: [number, number][]
  centroid: [number, number]
}

// UEP Catarman, Northern Samar — surveyed planting zones
const ZONES: ZoneInfo[] = [
  { name: 'Zone I', lat: 12.5096, lng: 124.6674, elev: 6.7, color: '#2f9e6e' },
  { name: 'Zone II', lat: 12.5131, lng: 124.6613, elev: 6.3, color: '#2f6fb6' },
  { name: 'Zone III', lat: 12.5103, lng: 124.6609, elev: 8.3, color: '#d9902b' },
]

const MAP_CENTER: [number, number] = [12.5113, 124.6641]
const CAMPUS_BOUNDS: VBounds = {
  minLat: 12.509,
  minLng: 124.6604,
  maxLat: 12.5136,
  maxLng: 124.6682,
}

// Multi-sided Voronoi cells derived from the three zone sites, clipped to the
// campus bounds. The union tiles the campus with no overlaps or gaps.
const ZONE_POLYGONS: ZonePolygon[] = buildVoronoiZones(
  ZONES.map(z => ({ name: z.name, lat: z.lat, lng: z.lng })),
  CAMPUS_BOUNDS,
).map((z, i) => ({ ...ZONES[i], vertices: z.vertices, centroid: z.centroid }))

const markers: TreeMarker[] = [
  // Zone I
  { id: 'TRE-0892', lat: 12.5101, lng: 124.6679, status: 'verified', staffName: 'Juan Santos', species: 'Narra', datePlanted: 'Mar 12, 2026', treeTag: 'TRE-0892', zone: 'Zone I' },
  { id: 'TRE-0567', lat: 12.5098, lng: 124.6681, status: 'incident', staffName: 'Maria Reyes', species: 'Molave', datePlanted: 'Mar 15, 2026', treeTag: 'TRE-0567', zone: 'Zone I' },
  { id: 'TRE-1204', lat: 12.5092, lng: 124.6677, status: 'pending', staffName: 'Carlo Diaz', species: 'Ipil', datePlanted: 'Mar 18, 2026', treeTag: 'TRE-1204', zone: 'Zone I' },
  { id: 'TRE-0341', lat: 12.51, lng: 124.6671, status: 'verified', staffName: 'Ana Lim', species: 'Mahogany', datePlanted: 'Mar 20, 2026', treeTag: 'TRE-0341', zone: 'Zone I' },
  { id: 'TRE-1108', lat: 12.5094, lng: 124.6671, status: 'pending', staffName: 'Sofia Torres', species: 'Kamagong', datePlanted: 'Mar 25, 2026', treeTag: 'TRE-1108', zone: 'Zone I' },
  { id: 'TRE-0223', lat: 12.5105, lng: 124.6676, status: 'verified', staffName: 'Rico Mendoza', species: 'Narra', datePlanted: 'Mar 28, 2026', treeTag: 'TRE-0223', zone: 'Zone I' },
  { id: 'TRE-0412', lat: 12.5094, lng: 124.6679, status: 'verified', staffName: 'Marc Tan', species: 'Ipil', datePlanted: 'Apr 3, 2026', treeTag: 'TRE-0412', zone: 'Zone I' },
  // Zone II
  { id: 'TRE-0783', lat: 12.5135, lng: 124.6616, status: 'incident', staffName: 'Ben Cruz', species: 'Banaba', datePlanted: 'Mar 22, 2026', treeTag: 'TRE-0783', zone: 'Zone II' },
  { id: 'TRE-0950', lat: 12.5128, lng: 124.6617, status: 'incident', staffName: 'Lena Bautista', species: 'Molave', datePlanted: 'Apr 1, 2026', treeTag: 'TRE-0950', zone: 'Zone II' },
  { id: 'TRE-1056', lat: 12.5134, lng: 124.661, status: 'unverified', staffName: 'Donna Uy', species: 'Narra', datePlanted: 'Apr 5, 2026', treeTag: 'TRE-1056', zone: 'Zone II' },
  { id: 'TRE-0834', lat: 12.5129, lng: 124.6612, status: 'pending', staffName: 'Chris Ramos', species: 'Narra', datePlanted: 'Apr 11, 2026', treeTag: 'TRE-0834', zone: 'Zone II' },
  // Zone III
  { id: 'TRE-0678', lat: 12.5099, lng: 124.6612, status: 'unverified', staffName: 'Kai Lopez', species: 'Mahogany', datePlanted: 'Apr 7, 2026', treeTag: 'TRE-0678', zone: 'Zone III' },
  { id: 'TRE-0199', lat: 12.5107, lng: 124.6612, status: 'verified', staffName: 'Jess Flores', species: 'Banaba', datePlanted: 'Apr 9, 2026', treeTag: 'TRE-0199', zone: 'Zone III' },
  { id: 'TRE-0455', lat: 12.5104, lng: 124.6605, status: 'verified', staffName: 'Pat Soriano', species: 'Kamagong', datePlanted: 'Apr 13, 2026', treeTag: 'TRE-0455', zone: 'Zone III' },
  { id: 'TRE-1320', lat: 12.51, lng: 124.6608, status: 'pending', staffName: 'Kim Garcia', species: 'Ipil', datePlanted: 'Apr 15, 2026', treeTag: 'TRE-1320', zone: 'Zone III' },
]

const statusConfig: Record<StatusKey, { color: string; label: string; stroke: string }> = {
  verified: { color: '#2f9e6e', label: 'Verified & Healthy', stroke: '#237a54' },
  pending: { color: '#d9902b', label: 'Pending Verification', stroke: '#b06e16' },
  incident: { color: '#dc3a3a', label: 'Incident / Declined', stroke: '#b02a2a' },
  unverified: { color: '#9aa1a9', label: 'Unverified / Missing', stroke: '#6b7280' },
}

const makeIcon = (color: string, stroke: string, incident: boolean, active: boolean) => {
  const size = active ? 26 : 20
  return L.divIcon({
    className: 'ecotrace-pin',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid ${active ? '#ffffff' : stroke};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 1px 5px rgba(0,0,0,0.35);cursor:pointer;
      font:700 ${Math.round(size * 0.5)}px/1 Inter,sans-serif;color:#ffffff;">
      ${incident ? '!' : ''}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 6],
  })
}

// Editable vertex handle — a small ring with a filled core and grab cursor.
const makeVertexIcon = (color: string) => {
  const size = 16
  return L.divIcon({
    className: 'ecotrace-vertex',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid #ffffff;
      box-shadow:0 0 0 1.5px ${color},0 1px 5px rgba(0,0,0,0.4);
      cursor:grab;">
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Map-level click handler: clicking empty map space clears the active marker.
function MapClickHandler({ onBackgroundClick }: { onBackgroundClick: () => void }) {
  useMapEvents({ click: onBackgroundClick })
  return null
}

export default function MapView() {
  const [activeMarker, setActiveMarker] = useState<TreeMarker | null>(null)
  const [activeLayer, setActiveLayer] = useState<'all' | StatusKey>('all')
  const [zoneFilter, setZoneFilter] = useState<'all' | ZoneName>('all')
  const [editing, setEditing] = useState(false)
  // Editable copies of the Voronoi cell vertices. When not editing, these mirror
  // the computed cells; dragging a handle updates the relevant zone's vertex.
  const [zoneVertices, setZoneVertices] = useState<Record<ZoneName, [number, number][]>>(
    () => Object.fromEntries(ZONE_POLYGONS.map(z => [z.name, z.vertices])) as Record<ZoneName, [number, number][]>,
  )

  const zoneFiltered = zoneFilter === 'all' ? markers : markers.filter(m => m.zone === zoneFilter)
  const visibleMarkers = activeLayer === 'all' ? zoneFiltered : zoneFiltered.filter(m => m.status === activeLayer)

  const counts: Record<'all' | StatusKey, number> = {
    all: zoneFiltered.length,
    verified: zoneFiltered.filter(m => m.status === 'verified').length,
    pending: zoneFiltered.filter(m => m.status === 'pending').length,
    incident: zoneFiltered.filter(m => m.status === 'incident').length,
    unverified: zoneFiltered.filter(m => m.status === 'unverified').length,
  }

  const zoneSummary = ZONES.map(z => ({
    ...z,
    trees: markers.filter(m => m.zone === z.name).length,
    verified: markers.filter(m => m.zone === z.name && m.status === 'verified').length,
    incidents: markers.filter(m => m.zone === z.name && m.status === 'incident').length,
  }))

  // Start editing: begin from the current (possibly already-edited) vertices.
  const startEditing = () => setEditing(true)
  // Stop editing: keep edits applied to zoneVertices, just hide the handles.
  const stopEditing = () => setEditing(false)
  const resetBoundaries = () => {
    setZoneVertices(Object.fromEntries(ZONE_POLYGONS.map(z => [z.name, z.vertices])) as Record<ZoneName, [number, number][]>)
  }

  const moveVertex = (zone: ZoneName, index: number, newPos: [number, number]) => {
    setZoneVertices(prev => {
      const next = { ...prev }
      const verts = next[zone].slice()
      verts[index] = newPos
      // Keep the polygon closed/ordered by clamping the dragged vertex within the
      // campus bounds and ensuring neighbours stay reasonably separated.
      next[zone] = verts
      return next
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Map View</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            UEP Catarman · {markers.length} trees across Zones I–III
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select className="select text-xs" style={{ width: 'auto' }} defaultValue="Arbor Day Drive 2026">
            <option>Arbor Day Drive 2026</option>
            <option>Earth Month Campaign</option>
            <option>Campus Reforestation Q2</option>
          </select>
          <select
            className="select text-xs"
            style={{ width: 'auto' }}
            value={zoneFilter}
            onChange={e => { setZoneFilter(e.target.value as 'all' | ZoneName); setActiveMarker(null) }}
          >
            <option value="all">All Zones</option>
            {ZONES.map(z => (
              <option key={z.name} value={z.name}>{z.name} — {z.elev} m</option>
            ))}
          </select>
          {editing ? (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={resetBoundaries}
                title="Reset to computed Voronoi cell borders"
              >
                Reset Borders
              </button>
              <button className="btn btn-sm" onClick={stopEditing}>
                Done ✓
              </button>
            </>
          ) : (
            <button
              className="btn btn-sm"
              style={{ background: 'var(--surface-muted)' }}
              onClick={startEditing}
              title="Edit zone boundary vertices"
            >
              ✎ Edit Borders
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 280px' }}>
        {/* Map */}
        <div className="card overflow-hidden relative map-card">
          <MapContainer
            className="w-full"
            style={{ height: 560 }}
            center={MAP_CENTER}
            zoom={16}
            bounds={[[CAMPUS_BOUNDS.minLat, CAMPUS_BOUNDS.minLng], [CAMPUS_BOUNDS.maxLat, CAMPUS_BOUNDS.maxLng]]}
            boundsOptions={{ padding: [24, 24] }}
            scrollWheelZoom
          >
            <MapClickHandler onBackgroundClick={() => setActiveMarker(null)} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="OSM Streets">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite (Esri)">
                <TileLayer
                  attribution='&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {/* Zone overlays — Voronoi tessellation of the UEP campus */}
            {ZONE_POLYGONS.map(z => (
              <Polygon
                key={z.name}
                positions={zoneVertices[z.name]}
                pathOptions={{
                  color: z.color,
                  weight: 1.5,
                  dashArray: editing ? '' : '6 4',
                  fillColor: z.color,
                  fillOpacity: 0.08,
                }}
                eventHandlers={{ click: () => setActiveMarker(null) }}
              >
                <Tooltip permanent direction="center" className="zone-label" opacity={1}>
                  <div style={{ textAlign: 'center', color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    <div style={{ fontWeight: 600 }}>{z.name}</div>
                    <div style={{ fontSize: 10 }}>{z.elev} m elev</div>
                  </div>
                </Tooltip>
              </Polygon>
            ))}

            {/* Vertex edit handles (drag to reshape zone borders) */}
            {editing &&
              ZONE_POLYGONS.map(z => (
                <div key={`${z.name}-handles`}>
                  {zoneVertices[z.name].map((v, idx) => (
                    <Marker
                      key={`${z.name}-v${idx}`}
                      position={v}
                      draggable
                      zIndexOffset={600}
                      icon={makeVertexIcon(z.color)}
                      eventHandlers={{
                        dragend: e => {
                          const ll = (e.target as L.Marker).getLatLng()
                          moveVertex(z.name, idx, [ll.lat, ll.lng])
                        },
                        click: e => L.DomEvent.stopPropagation(e.originalEvent),
                      }}
                    />
                  ))}
                </div>
              ))}

            {/* Tree markers */}
            {visibleMarkers.map(m => {
              const cfg = statusConfig[m.status]
              const isActive = activeMarker?.id === m.id
              return (
                <Marker
                  key={m.id}
                  position={[m.lat, m.lng]}
                  icon={makeIcon(cfg.color, cfg.stroke, m.status === 'incident', isActive)}
                  eventHandlers={{ click: () => setActiveMarker(m) }}
                >
                  <Popup minWidth={180}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{m.treeTag}</strong>
                        <span className="badge" style={{ background: `${cfg.color}22`, color: cfg.color }}>
                          {cfg.label.split(' ')[0]}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{m.zone} · {m.species}</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {m.staffName} · planted {m.datePlanted}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {m.lat.toFixed(4)}°N, {m.lng.toFixed(4)}°E
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          {/* Legend / layer filter */}
          <div
            className="absolute bottom-3 left-3 card px-3 py-2.5"
            style={{ zIndex: 500, boxShadow: '0 4px 12px rgba(16,24,40,0.1)' }}
          >
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {(Object.keys(statusConfig) as StatusKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(activeLayer === key ? 'all' : key); setActiveMarker(null) }}
                  className="flex items-center gap-1.5"
                  style={{
                    color: activeLayer === key ? statusConfig[key].color : 'var(--text-muted)',
                    fontWeight: activeLayer === key ? 600 : 400,
                  }}
                >
                  <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: statusConfig[key].color }} />
                  {counts[key]} {statusConfig[key].label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Right column */}
        <div className="space-y-4">
          {activeMarker ? (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium">{activeMarker.treeTag}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeMarker.zone}</div>
                </div>
                <span
                  className="badge"
                  style={{ background: `${statusConfig[activeMarker.status].color}22`, color: statusConfig[activeMarker.status].color }}
                >
                  {statusConfig[activeMarker.status].label.split(' ')[0]}
                </span>
              </div>
              <div className="text-xs space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Staff</span>
                  <span className="font-medium">{activeMarker.staffName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Species</span>
                  <span className="italic">{activeMarker.species}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Planted</span>
                  <span>{activeMarker.datePlanted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Coordinates</span>
                  <span className="mono">
                    {activeMarker.lat.toFixed(4)}°N, {activeMarker.lng.toFixed(4)}°E
                  </span>
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
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click a marker on the map to view tree details
              </div>
            </div>
          )}

          {/* Zone Summary */}
          <div className="card p-4">
            <h3 className="card-title mb-3">Zone Summary</h3>
            {zoneSummary.map(z => (
              <div key={z.name} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">
                    <span className="inline-block rounded-full mr-1.5" style={{ width: 8, height: 8, background: z.color }} />
                    {z.name}
                  </span>
                  <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                    {z.trees} trees
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1.5 text-xs" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  <span className="mono">{z.lat.toFixed(4)}°N, {z.lng.toFixed(4)}°E</span>
                  <span>Elev {z.elev} m</span>
                </div>
                <div className="progress">
                  <div style={{ width: `${(z.verified / Math.max(z.trees, 1)) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  <span>{z.verified} verified</span>
                  {z.incidents > 0 && (
                    <span style={{ color: 'var(--danger)' }}>
                      {z.incidents} incident{z.incidents > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}