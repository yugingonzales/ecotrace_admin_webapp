/**
 * EventBoundaryEditor — interactive map for drawing an event field boundary.
 * Mini mode: read-only preview + "Edit boundary" button.
 * Expanded mode: full map — click to add, drag to move, dbl-click to delete vertices.
 */
import * as L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Polygon, Polyline,
  LayersControl, useMap, useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CAMPUS_BOUNDS, framingBounds, boundaryArea, type Boundary, type ZoneName } from '../../lib/site'

const MAX_POINTS = 30

const ZONE_LABEL_TO_NAME: Record<string, ZoneName> = {
  'Zone A – Main Campus': 'Zone I',
  'Zone B – Annex Field': 'Zone III',
  'Zone C – Hillside Reserve': 'Zone II',
}

interface Props {
  zoneLabel?: string
  boundary: Boundary
  onChange: (b: Boundary) => void
  height?: number
  expanded?: boolean
  onExpand?: () => void
  onClose?: () => void
}

const pt = (lat: number, lng: number): [number, number] => [lat, lng]

function formatArea(m2: number): string {
  return m2 >= 10_000 ? `${(m2 / 10_000).toFixed(2)} ha` : `${Math.round(m2).toLocaleString()} m²`
}

function DrawClicks({ onAdd }: { onAdd: (p: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      const t = (e.originalEvent?.target as HTMLElement | null)
      if (t && (t.closest('.leaflet-marker-icon') || t.closest('.cc-boundary-grip'))) return
      onAdd(pt(e.latlng.lat, e.latlng.lng))
    },
  })
  return null
}

function FitToBoundary({ boundary }: { boundary: Boundary }) {
  const map = useMap()
  const count = boundary.length
  useEffect(() => {
    if (count < 2) return
    map.fitBounds(
      L.latLngBounds(boundary.map(p => L.latLng(p[0], p[1]))).pad(0.18),
    )
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── custom vertex drag ─────────────────────────────────────────────────────────
// Leaflet's built-in marker drag (via L.Draggable) stops the instant the pointer
// leaves the small 22×22 dot icon — so fast drags or auto-panning drop the drag.
// Instead we hand-roll a drag that captures the dot and listens on `window`, so
// it keeps going until the cursor is released no matter where it moves. Edge
// auto-pan keeps it working across the whole campus in one gesture.
const EDGE_MARGIN = 40 // px from the map edge before auto-pan kicks in
const MAX_PAN = 14     // px panned per move frame at full edge pressure

function panNearViewportEdge(map: L.Map, clientX: number, clientY: number) {
  const rect = map.getContainer().getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const size = map.getSize()
  let dx = 0
  let dy = 0
  if (x < EDGE_MARGIN) {
    dx = -(((EDGE_MARGIN - x) / EDGE_MARGIN) + 0.5) * MAX_PAN
  } else if (x > size.x - EDGE_MARGIN) {
    dx = (((x - (size.x - EDGE_MARGIN)) / EDGE_MARGIN) + 0.5) * MAX_PAN
  }
  if (y < EDGE_MARGIN) {
    dy = -(((EDGE_MARGIN - y) / EDGE_MARGIN) + 0.5) * MAX_PAN
  } else if (y > size.y - EDGE_MARGIN) {
    dy = (((y - (size.y - EDGE_MARGIN)) / EDGE_MARGIN) + 0.5) * MAX_PAN
  }
  if (dx !== 0 || dy !== 0) map.panBy(L.point(dx, dy), { animate: false })
}

function DraggableVertex({
  index,
  x,
  y,
  mapRef,
  editing,
  onMove,
  onDelete,
}: {
  index: number
  x: number
  y: number
  mapRef: React.MutableRefObject<L.Map | null>
  editing: boolean
  onMove: (i: number, lat: number, lng: number) => void
  onDelete: (i: number) => void
}) {
  const draggingRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editing) return
    const map = mapRef.current
    if (!map) return
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = true

    const handlePointerMove = (ev: PointerEvent) => {
      if (!draggingRef.current || !mapRef.current) return
      panNearViewportEdge(mapRef.current, ev.clientX, ev.clientY)
      const p = mapRef.current.containerPointToLatLng(mapRef.current.mouseEventToContainerPoint(ev))
      onMove(index, p.lat, p.lng)
    }
    const handlePointerUp = (ev: PointerEvent) => {
      if (!draggingRef.current || !mapRef.current) return
      draggingRef.current = false
      const p = mapRef.current.containerPointToLatLng(mapRef.current.mouseEventToContainerPoint(ev))
      onMove(index, p.lat, p.lng)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  return (
    <div
      className={`cc-boundary-grip${editing ? ' editing' : ''}`}
      style={{ left: x - 11, top: y - 11 }}
      onPointerDown={onPointerDown}
      onDoubleClick={() => { if (editing) onDelete(index) }}
      title={editing
        ? `Point ${index + 1} — drag to move · edge auto-pans · double-click to delete`
        : `Point ${index + 1}`}
    >
      <span>{index + 1}</span>
    </div>
  )
}

// Renders each vertex as an absolutely-positioned grip over the map, keeping
// positions in sync whenever the map pans or zooms.
function GripOverlay({
  points,
  mapRef,
  editing,
  onMove,
  onDelete,
}: {
  points: Boundary
  mapRef: React.MutableRefObject<L.Map | null>
  editing: boolean
  onMove: (i: number, lat: number, lng: number) => void
  onDelete: (i: number) => void
}) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  const [pts, setPts] = useState<{ i: number; x: number; y: number }[]>([])

  // Keep the latest points in a ref so the event-driven `place` callback
  // (registered once by useMapEvents) never reads a stale closure.
  const pointsRef = useRef(points)
  pointsRef.current = points

  const place = () => {
    const next = pointsRef.current.map(([lat, lng], i) => {
      const p = map.latLngToContainerPoint(L.latLng(lat, lng))
      return { i, x: p.x, y: p.y }
    })
    setPts(next)
  }

  useMapEvents({
    move: place,
    zoom: place,
    resize: place,
  })

  // Re-place when vertices change (added / dragged / removed).
  useEffect(() => { place() }, [points]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cc-grip-layer">
      {pts.map(({ i, x, y }) => (
        <DraggableVertex
          key={i}
          index={i}
          x={x}
          y={y}
          mapRef={mapRef}
          editing={editing}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default function EventBoundaryEditor({
  zoneLabel,
  boundary,
  onChange,
  height = 240,
  expanded = false,
  onExpand,
  onClose,
}: Props) {
  const editing = expanded
  const mapRef = useRef<L.Map | null>(null)
  const bounds = zoneLabel
    ? framingBounds(ZONE_LABEL_TO_NAME[zoneLabel] ?? '')
    : CAMPUS_BOUNDS
  const center: [number, number] = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ]
  const area = useMemo(() => boundaryArea(boundary), [boundary])
  const closed = boundary.length >= 3

  const add = (p: [number, number]) => {
    if (boundary.length >= MAX_POINTS) return
    onChange([...boundary, p])
  }
  const move = (i: number, lat: number, lng: number) => {
    onChange(boundary.map((v, j) => (j === i ? pt(lat, lng) : v)))
  }
  const remove = (i: number) => {
    if (boundary.length <= 3) return
    onChange(boundary.filter((_, j) => j !== i))
  }
  const undo = () => { if (boundary.length > 0) onChange(boundary.slice(0, -1)) }
  const clear = () => onChange([])

  const map = (
    <MapContainer
      key={zoneLabel || 'campus'}
      className="w-full"
      style={{ height: expanded ? '100%' : height }}
      center={center}
      zoom={16}
      bounds={[[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]]}
      boundsOptions={{ padding: [14, 14] }}
      scrollWheelZoom={expanded}
      doubleClickZoom={!editing}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OSM Streets">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <FitToBoundary boundary={boundary} />
      {editing && <DrawClicks onAdd={add} />}

      {closed && (
        <Polygon
          positions={boundary}
          pathOptions={{
            color: '#1f7a54', weight: 2.5, opacity: 0.9,
            fillColor: '#2f9e6e', fillOpacity: 0.18,
          }}
        />
      )}
      {!closed && boundary.length >= 2 && (
        <Polyline
          positions={boundary}
          pathOptions={{ color: '#2f6fb6', weight: 2.5, dashArray: '5 6', opacity: 0.8 }}
        />
      )}

      <GripOverlay points={boundary} mapRef={mapRef} editing={editing} onMove={move} onDelete={remove} />
    </MapContainer>
  )


  if (expanded) {
    return (
      <div className="overlay overlay-map">
        <div className="modal cc-map-modal">
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Event Field Boundary</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Staff verifications count only inside this boundary
              </p>
            </div>
            <button onClick={onClose} className="btn btn-sm">✕ Collapse</button>
          </div>

          <div className="cc-map-body cc-draw-mode relative">
            {map}
            {boundary.length === 0 && (
              <div className="cc-boundary-hint">
                <div>
                  <strong>Click the map to draw the boundary</strong>
                  <br />
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    3+ points closes the field · drag dots to adjust · double-click a dot to delete
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="flex items-center gap-3 mr-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="badge badge-accent">{boundary.length}/{MAX_POINTS} points</span>
              <span>{closed ? `Closed · ${formatArea(area)}` : 'Open — keep adding points'}</span>
            </div>
            <button type="button" className="btn btn-sm" onClick={undo} disabled={boundary.length === 0}>
              Undo
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={clear}
              disabled={boundary.length === 0}
            >
              Clear
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cc-event-map">
      <div className="relative">
        {map}
        <button
          type="button"
          onClick={onExpand}
          className="map-expand-btn"
          title="Draw or edit the event field boundary"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path
              d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit boundary
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
        <span>{boundary.length === 0 ? 'No boundary drawn yet' : `${boundary.length} boundary points`}</span>
        <span>{closed ? formatArea(area) : ''}</span>
      </div>
    </div>
  )
}
