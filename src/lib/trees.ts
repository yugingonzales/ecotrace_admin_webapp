/**
 * Shared tree inventory used by MapView (map display) and EventManagement
 * (boundary + date-range eligibility filter).
 */
import { pointInBoundary, type Boundary, type ZoneName } from './site'

export type StatusKey = 'verified' | 'pending' | 'incident' | 'unverified'

export interface TreeMarker {
  id: string
  lat: number
  lng: number
  status: StatusKey
  staffName: string
  species: string
  /** Human-readable display string, e.g. 'Mar 12, 2026'. */
  datePlanted: string
  /** ISO date string for reliable range comparison, e.g. '2026-03-12'. */
  plantedIso: string
  treeTag: string
  zone: ZoneName
}

/** Complete tree inventory (mock data). */
export const trees: TreeMarker[] = [
  // ── Zone I ────────────────────────────────────────────────────
  { id: 'TRE-0892', lat: 12.5101, lng: 124.6679, status: 'verified', staffName: 'Juan Santos', species: 'Narra', datePlanted: 'Mar 12, 2026', plantedIso: '2026-03-12', treeTag: 'TRE-0892', zone: 'Zone I' },
  { id: 'TRE-0567', lat: 12.5098, lng: 124.6681, status: 'incident', staffName: 'Maria Reyes', species: 'Molave', datePlanted: 'Mar 15, 2026', plantedIso: '2026-03-15', treeTag: 'TRE-0567', zone: 'Zone I' },
  { id: 'TRE-1204', lat: 12.5092, lng: 124.6677, status: 'pending', staffName: 'Carlo Diaz', species: 'Ipil', datePlanted: 'Mar 18, 2026', plantedIso: '2026-03-18', treeTag: 'TRE-1204', zone: 'Zone I' },
  { id: 'TRE-0341', lat: 12.51, lng: 124.6671, status: 'verified', staffName: 'Ana Lim', species: 'Mahogany', datePlanted: 'Mar 20, 2026', plantedIso: '2026-03-20', treeTag: 'TRE-0341', zone: 'Zone I' },
  { id: 'TRE-1108', lat: 12.5094, lng: 124.6671, status: 'pending', staffName: 'Sofia Torres', species: 'Kamagong', datePlanted: 'Mar 25, 2026', plantedIso: '2026-03-25', treeTag: 'TRE-1108', zone: 'Zone I' },
  { id: 'TRE-0223', lat: 12.5105, lng: 124.6676, status: 'verified', staffName: 'Rico Mendoza', species: 'Narra', datePlanted: 'Mar 28, 2026', plantedIso: '2026-03-28', treeTag: 'TRE-0223', zone: 'Zone I' },
  { id: 'TRE-0412', lat: 12.5094, lng: 124.6679, status: 'verified', staffName: 'Marc Tan', species: 'Ipil', datePlanted: 'Apr 3, 2026', plantedIso: '2026-04-03', treeTag: 'TRE-0412', zone: 'Zone I' },
  // ── Zone I · 2025 cohort (eligible for Jan–Dec 2025 filter) ──
  { id: 'TRE-1501', lat: 12.5097, lng: 124.6673, status: 'verified', staffName: 'Luis Reyes', species: 'Narra', datePlanted: 'Jan 15, 2025', plantedIso: '2025-01-15', treeTag: 'TRE-1501', zone: 'Zone I' },
  { id: 'TRE-1502', lat: 12.5103, lng: 124.6680, status: 'pending', staffName: 'Ria Santos', species: 'Molave', datePlanted: 'Jun 20, 2025', plantedIso: '2025-06-20', treeTag: 'TRE-1502', zone: 'Zone I' },
  { id: 'TRE-1503', lat: 12.5089, lng: 124.6675, status: 'verified', staffName: 'Nico Bautista', species: 'Kamagong', datePlanted: 'Nov 8, 2025', plantedIso: '2025-11-08', treeTag: 'TRE-1503', zone: 'Zone I' },

  // ── Zone II ───────────────────────────────────────────────────
  { id: 'TRE-0783', lat: 12.5135, lng: 124.6616, status: 'incident', staffName: 'Ben Cruz', species: 'Banaba', datePlanted: 'Mar 22, 2026', plantedIso: '2026-03-22', treeTag: 'TRE-0783', zone: 'Zone II' },
  { id: 'TRE-0950', lat: 12.5128, lng: 124.6617, status: 'incident', staffName: 'Lena Bautista', species: 'Molave', datePlanted: 'Apr 1, 2026', plantedIso: '2026-04-01', treeTag: 'TRE-0950', zone: 'Zone II' },
  { id: 'TRE-1056', lat: 12.5134, lng: 124.661, status: 'unverified', staffName: 'Donna Uy', species: 'Narra', datePlanted: 'Apr 5, 2026', plantedIso: '2026-04-05', treeTag: 'TRE-1056', zone: 'Zone II' },
  { id: 'TRE-0834', lat: 12.5129, lng: 124.6612, status: 'pending', staffName: 'Chris Ramos', species: 'Narra', datePlanted: 'Apr 11, 2026', plantedIso: '2026-04-11', treeTag: 'TRE-0834', zone: 'Zone II' },
  // ── Zone II · 2025 cohort ──
  { id: 'TRE-1504', lat: 12.5132, lng: 124.6614, status: 'verified', staffName: 'Ella Torres', species: 'Ipil', datePlanted: 'Mar 5, 2025', plantedIso: '2025-03-05', treeTag: 'TRE-1504', zone: 'Zone II' },
  { id: 'TRE-1505', lat: 12.5127, lng: 124.6615, status: 'incident', staffName: 'Mark Dela Cruz', species: 'Banaba', datePlanted: 'Aug 18, 2025', plantedIso: '2025-08-18', treeTag: 'TRE-1505', zone: 'Zone II' },
  // ── Out-of-range tree (Dec 2024 — excluded from Jan–Dec 2025) ──
  { id: 'TRE-1506', lat: 12.5130, lng: 124.6611, status: 'verified', staffName: 'Sara Lim', species: 'Mahogany', datePlanted: 'Dec 1, 2024', plantedIso: '2024-12-01', treeTag: 'TRE-1506', zone: 'Zone II' },

  // ── Zone III ──────────────────────────────────────────────────
  { id: 'TRE-0678', lat: 12.5099, lng: 124.6612, status: 'unverified', staffName: 'Kai Lopez', species: 'Mahogany', datePlanted: 'Apr 7, 2026', plantedIso: '2026-04-07', treeTag: 'TRE-0678', zone: 'Zone III' },
  { id: 'TRE-0199', lat: 12.5107, lng: 124.6612, status: 'verified', staffName: 'Jess Flores', species: 'Banaba', datePlanted: 'Apr 9, 2026', plantedIso: '2026-04-09', treeTag: 'TRE-0199', zone: 'Zone III' },
  { id: 'TRE-0455', lat: 12.5104, lng: 124.6605, status: 'verified', staffName: 'Pat Soriano', species: 'Kamagong', datePlanted: 'Apr 13, 2026', plantedIso: '2026-04-13', treeTag: 'TRE-0455', zone: 'Zone III' },
  { id: 'TRE-1320', lat: 12.51, lng: 124.6608, status: 'pending', staffName: 'Kim Garcia', species: 'Ipil', datePlanted: 'Apr 15, 2026', plantedIso: '2026-04-15', treeTag: 'TRE-1320', zone: 'Zone III' },
  // ── Zone III · 2025 cohort ──
  { id: 'TRE-1507', lat: 12.5101, lng: 124.6609, status: 'verified', staffName: 'Jay Pascual', species: 'Narra', datePlanted: 'Feb 10, 2025', plantedIso: '2025-02-10', treeTag: 'TRE-1507', zone: 'Zone III' },
  { id: 'TRE-1508', lat: 12.5106, lng: 124.6610, status: 'pending', staffName: 'Rina Garcia', species: 'Molave', datePlanted: 'Sep 22, 2025', plantedIso: '2025-09-22', treeTag: 'TRE-1508', zone: 'Zone III' },
]

/* ── Eligibility filter ────────────────────────────────────────── */

/** Expand a user-selected ISO date to a whole-month range (first → last day). */
function monthBounds(isoDate: string): [string, string] | null {
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
 */
export function treesEligibleForVerification(
  boundary: Boundary,
  plantedFrom: string,
  plantedTo: string,
): TreeMarker[] {
  if (boundary.length < 3 || !plantedFrom || !plantedTo) return []

  const [lower] = monthBounds(plantedFrom) ?? []
  const [, upper] = monthBounds(plantedTo) ?? []
  if (!lower || !upper) return []

  return trees.filter(
    t =>
      pointInBoundary(boundary, t.lat, t.lng) &&
      t.plantedIso >= lower &&
      t.plantedIso <= upper,
  )
}