// Voronoi tessellation helpers for UEP campus planting zones.
// Projects lat/lng to local planar meters (equirectangular around a centroid),
// computes a Voronoi cell for each site by clipping against perpendicular
// bisectors (Sutherland–Hodgman), then converts cell vertices back to lat/lng.
// Result: multi-sided polygons that tile the campus with shared borders,
// no overlaps and no gaps.

export interface VSite {
  lat: number
  lng: number
}

export interface VBounds {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

// Approx meters per degree at the campus latitude (~12.51°N)
const M_PER_DEG_LAT = 110574
const M_PER_DEG_LNG = 111320 * Math.cos((12.5113 * Math.PI) / 180)

type Vec = { x: number; y: number }

const toMeters = (v: VSite, cx: number, cy: number): Vec => ({
  x: (v.lng - cx) * M_PER_DEG_LNG,
  y: (v.lat - cy) * M_PER_DEG_LAT,
})

const toLatLng = (p: Vec, cx: number, cy: number): [number, number] => [
  cy + p.y / M_PER_DEG_LAT,
  cx + p.x / M_PER_DEG_LNG,
]

// Cross product sign of point p relative to directed line (a -> b).
// Returns true if p is strictly on the left side (positive cross product),
// false if on the right side.
const crossSign = (p: Vec, a: Vec, b: Vec): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

// True if p is on the same side of line (a->b) as `keep`.
const isInside = (p: Vec, a: Vec, b: Vec, keep: Vec): boolean => {
  const pSign = crossSign(p, a, b)
  const keepSign = crossSign(keep, a, b)
  // Treat points exactly on the line as inside.
  if (pSign === 0) return true
  if (keepSign === 0) return true
  return (pSign > 0) === (keepSign > 0)
}

const intersection = (p1: Vec, p2: Vec, a: Vec, b: Vec): Vec => {
  const d1 = (b.x - a.x) * (p1.y - a.y) - (b.y - a.y) * (p1.x - a.x)
  const d2 = (b.x - a.x) * (p2.y - a.y) - (b.y - a.y) * (p2.x - a.x)
  const t = d1 / (d1 - d2)
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
}

// Sutherland–Hodgman clip: keeps the portion of `poly` on the same side of
// line (a->b) as `keep`.
const clipHalfPlane = (poly: Vec[], a: Vec, b: Vec, keep: Vec): Vec[] => {
  const out: Vec[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    const curIn = isInside(cur, a, b, keep)
    const prevIn = isInside(prev, a, b, keep)
    if (curIn) {
      if (!prevIn) out.push(intersection(prev, cur, a, b))
      out.push(cur)
    } else if (prevIn) {
      out.push(intersection(prev, cur, a, b))
    }
  }
  return out
}

// Compute the Voronoi cell for `site` given all sites, clipped to the bounds.
// `b` carries the clipping rectangle in meter space plus the projection center.
const voronoiCell = (
  site: VSite,
  sites: VSite[],
  b: { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number },
): Vec[] => {
  // Start with the clipping rectangle in meter space.
  let poly: Vec[] = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ]
  const me = toMeters(site, b.cx, b.cy)
  for (const other of sites) {
    if (other === site || (other.lat === site.lat && other.lng === site.lng)) continue
    const o = toMeters(other, b.cx, b.cy)
    // Perpendicular bisector between me and o. Midpoint m; direction perpendicular to (me - o).
    const mx = (me.x + o.x) / 2
    const my = (me.y + o.y) / 2
    const dx = o.x - me.x
    const dy = o.y - me.y
    // Bisector direction (perpendicular): ( -dy, dx ) normalized is not needed for line.
    const a: Vec = { x: mx - dy, y: my + dx }
    const c: Vec = { x: mx + dy, y: my - dx }
    poly = clipHalfPlane(poly, a, c, me)
    if (poly.length < 3) break
  }
  return poly
}

export interface ZoneVoronoi {
  name: string
  site: VSite
  vertices: [number, number][]
  centroid: [number, number]
}

export interface ZoneSeed {
  name: string
  lat: number
  lng: number
}

/**
 * Build Voronoi cells for a set of zone "site" coordinates, clipped to the
 * campus bounding rectangle. Returns one multi-sided polygon per zone, ordered
 * with clockwise/ccw-consistent vertices ready for react-leaflet `Polygon`.
 */
export function buildVoronoiZones(
  seeds: ZoneSeed[],
  bounds: VBounds,
): ZoneVoronoi[] {
  const cx = (bounds.minLng + bounds.maxLng) / 2
  const cy = (bounds.minLat + bounds.maxLat) / 2
  const b = {
    minX: (bounds.minLng - cx) * M_PER_DEG_LNG,
    maxX: (bounds.maxLng - cx) * M_PER_DEG_LNG,
    minY: (bounds.minLat - cy) * M_PER_DEG_LAT,
    maxY: (bounds.maxLat - cy) * M_PER_DEG_LAT,
    cx,
    cy,
  }
  const sites: VSite[] = seeds.map(s => ({ lat: s.lat, lng: s.lng }))

  return seeds.map(seed => {
    const cell = voronoiCell({ lat: seed.lat, lng: seed.lng }, sites, b)
    const vertices: [number, number][] = cell.map(p => toLatLng(p, cx, cy))
    // Area-weighted polygon centroid for label placement.
    let a = 0
    let cxAcc = 0
    let cyAcc = 0
    for (let i = 0; i < cell.length; i++) {
      const p = cell[i]
      const q = cell[(i + 1) % cell.length]
      const cross = p.x * q.y - q.x * p.y
      a += cross
      cxAcc += (p.x + q.x) * cross
      cyAcc += (p.y + q.y) * cross
    }
    a *= 0.5
    const centroid: [number, number] =
      a !== 0
        ? toLatLng({ x: cxAcc / (6 * a), y: cyAcc / (6 * a) }, cx, cy)
        : [seed.lat, seed.lng]

    return { name: seed.name, site: { lat: seed.lat, lng: seed.lng }, vertices, centroid }
  })
}
