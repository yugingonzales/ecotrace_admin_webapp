// Shared UEP campus site geometry and helpers reused across map views.
// UEP Catarman, Northern Samar — surveyed planting zones.

/**
 * @typedef {object} VBounds
 * @property {number} minLat
 * @property {number} minLng
 * @property {number} maxLat
 * @property {number} maxLng
 */

/** @typedef {'Zone I' | 'Zone II' | 'Zone III'} ZoneName */

/**
 * @typedef {object} ZoneInfo
 * @property {ZoneName} name
 * @property {number} lat
 * @property {number} lng
 * @property {number} elev
 * @property {string} color
 */

/** @type {ZoneInfo[]} */
export const ZONES = [
  { name: 'Zone I', lat: 12.5096, lng: 124.6674, elev: 6.7, color: '#2f9e6e' },
  { name: 'Zone II', lat: 12.5131, lng: 124.6613, elev: 6.3, color: '#2f6fb6' },
  { name: 'Zone III', lat: 12.5103, lng: 124.6609, elev: 8.3, color: '#d9902b' },
]

/** @type {[number, number]} */
export const MAP_CENTER = [12.5113, 124.6641]

/**
 * Event `zone` label -> surveyed planting zone. Lived privately inside
 * EventBoundaryEditor; promoted here so MapView's event filter and the boundary
 * editor can never disagree about which zone an event label means.
 */
/** @type {Record<string, ZoneName>} */
export const ZONE_LABEL_TO_NAME = {
  'Zone A – Main Campus': 'Zone I',
  'Zone B – Annex Field': 'Zone III',
  'Zone C – Hillside Reserve': 'Zone II',
}

/**
 * Reverse lookup, for showing a surveyed zone back as an event label.
 * @param {ZoneName} name
 * @returns {string | null}
 */
export function zoneNameToLabel(name) {
  for (const [label, zone] of Object.entries(ZONE_LABEL_TO_NAME)) if (zone === name) return label
  return null
}

/** @type {VBounds} */
export const CAMPUS_BOUNDS = {
  minLat: 12.509,
  minLng: 124.6604,
  maxLat: 12.5136,
  maxLng: 124.6682,
}

/**
 * Event field boundary — an ordered ring of [lat, lng] vertices.
 * Implicitly closed when drawn/validated (≥ 3 points required).
 * @typedef {[number, number][]} Boundary
 */

/**
 * Approximate enclosed area (m²) via the shoelace formula on equirectangular coords.
 * @param {Boundary} boundary
 * @returns {number}
 */
export function boundaryArea(boundary) {
  if (boundary.length < 3) return 0
  let twice = 0
  for (let i = 0; i < boundary.length; i++) {
    const [lat0, lng0] = boundary[i]
    const [lat1, lng1] = boundary[(i + 1) % boundary.length]
    twice += lng0 * lat1 - lng1 * lat0
  }
  const degArea = Math.abs(twice) / 2
  const avgLat = boundary.reduce((sum, p) => sum + p[0], 0) / boundary.length
  const mPerDeg = 111320
  const lngScale = Math.cos((avgLat * Math.PI) / 180)
  return degArea * mPerDeg * mPerDeg * lngScale
}

/**
 * Ray-casting point-in-polygon test — returns true if (lat, lng) is inside the boundary ring.
 * @param {Boundary} boundary
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function pointInBoundary(boundary, lat, lng) {
  if (boundary.length < 3) return false
  let inside = false
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const [yi, xi] = boundary[i]
    const [yj, xj] = boundary[j]
    if (
      ((xi > lng) !== (xj > lng)) &&
      (lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi)
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Bounding box that frames a single zone on the map.
 * @param {string} zoneName
 * @returns {VBounds}
 */
export function framingBounds(zoneName) {
  const zone = ZONES.find(z => zoneName.includes(z.name) || z.name === zoneName)
  if (!zone) return CAMPUS_BOUNDS
  const pad = 0.0012
  return {
    minLat: zone.lat - pad,
    minLng: zone.lng - pad - 0.0015,
    maxLat: zone.lat + pad,
    maxLng: zone.lng + pad + 0.0015,
  }
}

