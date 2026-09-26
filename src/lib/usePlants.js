/**
 * Tree inventory source for the admin map.
 *
 * ## Design rule: the map is never blank
 * `trees` from `lib/trees.js` is the offline baseline and is returned
 * synchronously on the very first render, before any request is issued. If the
 * API is disabled, unreachable, slow, or returns something malformed, the hook
 * keeps serving that baseline and raises `stale` so the UI can show a banner.
 * It never resolves to an empty array.
 *
 * That matters more than it looks: MapView derives its status counts, layer
 * filters and per-zone summary from the array it is given. An empty array would
 * render a map that looks correct but reports "0 trees across Zones I-III" and
 * shows every filter as empty — a silent, plausible-looking data loss. A stale
 * map with a warning is the honest failure.
 */
import { useEffect, useMemo, useState } from 'react'
import { trees as fallbackMarkers } from './trees'
import { API_ENABLED, listPlants } from './api'

/** @typedef {import('./trees.js').TreeMarker} TreeMarker */
/** @typedef {import('./trees.js').StatusKey} StatusKey */
/** @typedef {import('./types.js').Paginated<import('./types.js').Plant>} Paginated */
/** @typedef {import('./types.js').Plant} Plant */

/** Never trust a server list to be bounded — this is what a broken API costs. */
const MAX_MARKERS = 5000

/**
 * '2026-03-12' -> 'Mar 12, 2026'. Invalid input is passed through, not thrown.
 * @param {string} iso
 * @returns {string}
 */
function formatForDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const [, y, mo, d] = m
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[Number(mo) - 1]
  if (!month) return iso
  return `${month} ${Number(d)}, ${y}`
}
/**
 * Translate a `Plant` row into the `TreeMarker` shape MapView renders.
 *
 * This is the single boundary between the database vocabulary and the admin's
 * own. The two overlap only partially (see INTEGRATION_PROGRESS_LOG.md), so the
 * narrowing below is a deliberate projection, not a rename.
 *
 * Returns null for rows the map cannot honestly draw, so one bad row degrades to
 * a missing pin rather than a pin at 0,0 off the coast of Africa.
 *
 * @param {Plant} p
 * @returns {TreeMarker | null}
 */
export function plantToMarker(p) {
  // tree_code is the map's identity. Rows predating migration 001 have none, and
  // a marker without a tag cannot be linked to a submission, so it is dropped
  // rather than rendered with a fabricated id.
  if (!p.tree_code) return null
  if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return null

  // plant_status is the workflow axis. 'deceased' exists in the database for the
  // deferred dead-tree loop but has no marker in trees.ts, so it is filtered out
  // upstream by the query rather than mapped to a misleading pin colour here.
  const status = /** @type {StatusKey} */ (p.plant_status)
  if (status !== 'verified' && status !== 'pending' && status !== 'incident' && status !== 'unverified') {
    return null
  }

  return {
    id: p.tree_code,
    treeTag: p.tree_code,
    lat: p.latitude,
    lng: p.longitude,
    status,
    // The seed parks the planter name in location_address because the table has
    // no planter column. That is a dev-seed hack (see the seed header); until a
    // real column exists this is the best available.
    staffName: p.location_address ?? 'Unassigned',
    species: p.plant_species,
    datePlanted: formatForDisplay(p.planted_date),
    plantedIso: p.planted_date,
    zone: /** @type {TreeMarker['zone']} */ (p.zone_name ?? 'Zone I'),
  }
}

/**
 * @typedef {object} UsePlantsResult
 * @property {TreeMarker[]} markers Always a renderable, non-empty array.
 * @property {boolean} loading True only during the initial fetch, when `markers` is
 *   still the baseline.
 * @property {boolean} stale True when the rendered data is the local baseline rather
 *   than the server's.
 * @property {string | null} error Set when a fetch was attempted and failed. Null
 *   while healthy.
 * @property {() => void} refresh Re-run the fetch. Used by the stale banner's
 *   "Retry" control.
 */


/** @returns {UsePlantsResult} */
export function usePlants() {
  // Baseline is the initial value, so the first paint already has all 23 trees.
  // The generic is pinned by casting the `useState` argument. A `@type` comment
  // on the destructuring line would annotate the whole [value, setter] tuple and
  // destroy the setters, so it must not go there.
  const [markers, setMarkers] = useState(
    /** @type {TreeMarker[]} */ (fallbackMarkers),
  )
  const [loading, setLoading] = useState(API_ENABLED)
  const [stale, setStale] = useState(!API_ENABLED)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // With the flag off, stay on the baseline forever and issue no request.
    if (!API_ENABLED) {
      setMarkers(fallbackMarkers)
      setLoading(false)
      setStale(true)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)

    listPlants({ pageSize: MAX_MARKERS })
      .then(page => {
        if (cancelled) return
        // `plantToMarker` yields TreeMarker | null. The `m is TreeMarker` type
        // predicate that narrowed this in TypeScript has no JSDoc equivalent, so
        // the narrowed result is asserted here instead. Safe because the filter
        // condition below is exactly the predicate's own.
        const mapped = /** @type {TreeMarker[]} */ (
          page.items.map(plantToMarker).filter(m => m !== null)
        )

        if (mapped.length === 0) {
          // A 200 with zero usable rows is a failure, not an empty campus. Keep
          // the baseline; the banner explains it.
          setError('API returned no usable trees')
          setStale(true)
        } else {
          setMarkers(mapped)
          setStale(false)
          setError(null)
        }
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to reach the EcoTrace API')
        setStale(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [attempt])

  return useMemo(
    () => ({ markers, loading, stale, error, refresh: () => setAttempt((n) => n + 1) }),
    [markers, loading, stale, error],
  )
}
