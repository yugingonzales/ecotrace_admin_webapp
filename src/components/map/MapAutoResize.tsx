import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Keeps a Leaflet map correct when its container is hidden and re-shown.
 *
 * The app keeps every visited module mounted (so switching tabs does not throw
 * away filter state) and hides inactive ones with `display: none`. Leaflet
 * measures the container on creation and caches the result, so a map that was
 * laid out at 0×0 renders as a grey block with misplaced tiles. A
 * `ResizeObserver` on the map container fires the moment it is given a real
 * size again, and `invalidateSize()` re-reads it.
 *
 * This is why MapView and the event boundary editor can stay mounted instead of
 * being torn down and rebuilt on every tab switch.
 */
export default function MapAutoResize() {
  const map = useMap()

  useEffect(() => {
    const el = map.getContainer()
    // The container may already be 0×0 at mount; Leaflet's own resize on the
    // first frame handles the visible case, this handles everything after.
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  return null
}
