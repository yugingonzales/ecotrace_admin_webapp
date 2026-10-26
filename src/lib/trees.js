/**
 * Shared tree inventory used by MapView (map display) and EventManagement
 * (boundary + date-range eligibility filter).
 */
import * as L from 'leaflet'
import { pointInBoundary } from './site.js'

/** @type {Record<StatusKey, { color: string, label: string, stroke: string }>} */
export const treeStatusConfig = {
  verified: { color: '#0d6e4f', label: 'Verified & Healthy', stroke: '#0d382c' },
  pending: { color: '#ffd600', label: 'Pending Verification', stroke: '#b26a00' },
  incident: { color: '#c74545', label: 'Incident / Declined', stroke: '#9c2f2f' },
  unverified: { color: '#8eb3a0', label: 'Unverified / Missing', stroke: '#6b8277' },
}

const glyphColor = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1f2d28' : '#ffffff'
}

const treeGlyph = (size, fill, markerColor) => encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 9}" viewBox="0 0 40 49" aria-hidden="true">` +
  `<ellipse cx="20" cy="46" rx="13" ry="2.5" fill="none" stroke="${markerColor}" stroke-width="2" opacity=".55"/>` +
  `<path d="M11 27 20 40 29 27Z" fill="${markerColor}"/>` +
  `<circle cx="20" cy="18" r="15.5" fill="${markerColor}" stroke="#fff" stroke-width="2"/>` +
  `<path d="M20 27V11M20 17c-5.5-1-7.5-4.5-7.5-7.5C16 9.5 20 12 20 17Zm0 4c5.5-1 7.5-4.5 7.5-7.5C24 13.5 20 16 20 21Z" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
)

/** Shared status-colored tree marker used by the campus map and boundary editor. */
export function makeTreeIcon(status, active = false) {
  const config = treeStatusConfig[status] ?? treeStatusConfig.unverified
  const size = active ? 30 : 25
  return L.divIcon({
    className: 'ecotrace-pin',
    html: `<div style="position:relative;width:${size}px;height:${size + 9}px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));cursor:pointer"><img src="data:image/svg+xml;utf8,${treeGlyph(size, glyphColor(config.color), config.color)}" width="${size}px" height="${size + 9}px" alt="" style="display:block"/>${status === 'incident' ? '<span style="position:absolute;top:-3px;right:-4px;width:13px;height:13px;border-radius:50%;background:#c74545;border:1px solid #fff;color:#fff;font:700 9px/1 Segoe UI,system-ui,sans-serif;display:flex;align-items:center;justify-content:center">!</span>' : ''}</div>`,
    iconSize: [size, size + 9],
    iconAnchor: [size / 2, size + 2],
    popupAnchor: [0, -size - 2],
  })
}

/** @typedef {import('./site.js').Boundary} Boundary */
/** @typedef {import('./site.js').ZoneName} ZoneName */

/** @typedef {'verified' | 'pending' | 'incident' | 'unverified'} StatusKey */

/**
 * @typedef {Object} TreeMarker
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {StatusKey} status
 * @property {string} staffName
 * @property {string} species
 * @property {string} datePlanted  Human-readable display string, e.g. 'Mar 12, 2026'.
 * @property {string} plantedIso   ISO date string for reliable range comparison, e.g. '2026-03-12'.
 * @property {string} treeTag
 * @property {ZoneName} zone
 */

/**
 * Five local test trees distributed across the surveyed campus areas.
 *
 * The API-backed inventory is used when `VITE_ENABLE_API=true`; these records
 * are the offline fallback so event creation and geofencing remain testable
 * without a database connection.
 *
 * @type {TreeMarker[]}
 */
export const trees = [
  { id: 'TEST-TREE-01', lat: 12.5098, lng: 124.6676, status: 'verified', staffName: 'Test Staff 1', species: 'Narra', datePlanted: 'Mar 12, 2026', plantedIso: '2026-03-12', treeTag: 'TEST-TREE-01', zone: 'Zone I' },
  { id: 'TEST-TREE-02', lat: 12.5131, lng: 124.6614, status: 'pending', staffName: 'Test Staff 2', species: 'Molave', datePlanted: 'Mar 15, 2026', plantedIso: '2026-03-15', treeTag: 'TEST-TREE-02', zone: 'Zone II' },
  { id: 'TEST-TREE-03', lat: 12.5103, lng: 124.6609, status: 'unverified', staffName: 'Test Staff 3', species: 'Ipil', datePlanted: 'Mar 18, 2026', plantedIso: '2026-03-18', treeTag: 'TEST-TREE-03', zone: 'Zone III' },
  { id: 'TEST-TREE-04', lat: 12.5118, lng: 124.6647, status: 'incident', staffName: 'Test Staff 4', species: 'Mahogany', datePlanted: 'Mar 21, 2026', plantedIso: '2026-03-21', treeTag: 'TEST-TREE-04', zone: 'Zone I' },
  { id: 'TEST-TREE-05', lat: 12.5095, lng: 124.6628, status: 'verified', staffName: 'Test Staff 5', species: 'Kamagong', datePlanted: 'Mar 24, 2026', plantedIso: '2026-03-24', treeTag: 'TEST-TREE-05', zone: 'Zone III' },
]

/* ── Eligibility filter ────────────────────────────────────────── */

/**
 * Expand a user-selected ISO date to a whole-month range (first -> last day).
 *
 * @param {string} isoDate
 * @returns {[string, string] | null}
 */
function monthBounds(isoDate) {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!year || !month) return null
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return [first, last]
}

/**
 * Return every tree that falls inside the event boundary **and** was planted
 * within the supplied date range (normalized to whole months for comparison).
 *
 * @param source Candidate trees. Defaults to the bundled fixture, but callers
 *   that already hold API-backed data should pass it in — otherwise this filter
 *   silently ignores what the server returned and the event's eligible-tree
 *   count contradicts the map beside it.
 *
 * The filtering stays client-side because `boundary` is a polygon and the
 * point-in-polygon test has no server equivalent.
 *
 * @param {Boundary} boundary
 * @param {string} plantedFrom
 * @param {string} plantedTo
 * @param {TreeMarker[]} [source]
 * @returns {TreeMarker[]}
 */
export function treesEligibleForVerification(
  boundary,
  plantedFrom,
  plantedTo,
  source = trees,
) {
  if (boundary.length < 3 || !plantedFrom || !plantedTo) return []

  const [lower] = monthBounds(plantedFrom) ?? []
  const [, upper] = monthBounds(plantedTo) ?? []
  if (!lower || !upper) return []

  return source.filter(
    t =>
      pointInBoundary(boundary, t.lat, t.lng) &&
      t.plantedIso >= lower &&
      t.plantedIso <= upper,
  )
}