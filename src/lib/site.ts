// Shared UEP campus site geometry and helpers reused across map views.
// UEP Catarman, Northern Samar — surveyed planting zones.
export interface VBounds {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

export type ZoneName = 'Zone I' | 'Zone II' | 'Zone III'

export interface ZoneInfo {
  name: ZoneName
  lat: number
  lng: number
  elev: number
  color: string
}

export const ZONES: ZoneInfo[] = [
  { name: 'Zone I', lat: 12.5096, lng: 124.6674, elev: 6.7, color: '#2f9e6e' },
  { name: 'Zone II', lat: 12.5131, lng: 124.6613, elev: 6.3, color: '#2f6fb6' },
  { name: 'Zone III', lat: 12.5103, lng: 124.6609, elev: 8.3, color: '#d9902b' },
]

export const MAP_CENTER: [number, number] = [12.5113, 124.6641]

export const CAMPUS_BOUNDS: VBounds = {
  minLat: 12.509,
  minLng: 124.6604,
  maxLat: 12.5136,
  maxLng: 124.6682,
}

/**
 * Event field boundary — an ordered ring of [lat, lng] vertices.
 * Implicitly closed when drawn/validated (≥ 3 points required).
 */
export type Boundary = [number, number][]

/** Approximate enclosed area (m²) via the shoelace formula on equirectangular coords. */
export function boundaryArea(boundary: Boundary): number {
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

/** Ray-casting point-in-polygon test — returns true if (lat, lng) is inside the boundary ring. */
export function pointInBoundary(boundary: Boundary, lat: number, lng: number): boolean {
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

/** Bounding box that frames a single zone on the map. */
export function framingBounds(zoneName: string): VBounds {
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

