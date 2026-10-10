/**
 * Adjustable width for the navigation rail.
 *
 * ## Why this is a hook and not a constant
 * The rail used to be a module constant — `SIDEBAR_WIDTH = 244` — imported by
 * both `Sidebar` (as the `aside`'s width) and `App` (as the main column's
 * `marginLeft`). That worked precisely because the number could never change:
 * two consumers, one value, no way to drift. Making the rail draggable breaks
 * the premise, because now the number changes on every pointer move. If the two
 * consumers each held their own copy of it, the rail and the content column
 * would part company mid-drag, so the width became state owned above both of
 * them and handed down — still one value, still no way to drift, now live.
 *
 * ## Why the bounds live here and not in `variables.css`
 * Every other magic number in this app is a design token. These three are not:
 * they are the clamp the drag and the keyboard both go through, and a copy of
 * them in CSS could not be read by that clamp. Duplicating them would recreate
 * exactly the second-source-of-truth problem described above, one layer down.
 *
 * @typedef {import('react').PointerEvent<HTMLElement>} PointerEventOf
 * @typedef {import('react').KeyboardEvent<HTMLElement>} KeyboardEventOf
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEscapeToClose } from './useEscapeToClose'

/** Narrower than this and "Event Management" starts to truncate. */
export const SIDEBAR_MIN_WIDTH = 200

/** Wider than this and the rail stops being chrome and starts being the page. */
export const SIDEBAR_MAX_WIDTH = 420

/** The rail's resting width — the value the old `SIDEBAR_WIDTH` constant held. */
export const SIDEBAR_DEFAULT_WIDTH = 244

/** Named alongside `ecotrace_admin_token` / `ecotrace_store_v1`. */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'ecotrace_admin_sidebar_width'

/** Fine nudge for a single arrow-key press. */
const NUDGE = 8

/** Coarse nudge for Shift+arrow, for crossing the range in a few presses. */
const NUDGE_COARSE = 32

/**
 * Set on `<html>` for the duration of a drag. Pointer capture keeps events
 * coming from the handle, but the *cursor* is still resolved by hit-testing
 * whatever happens to be under the pointer — so without this it reverts to a
 * text caret, or a hand over a button, as soon as the drag leaves the rail.
 * The rule that reads it is `.eco-sidebar-dragging` in components.css.
 */
const DRAGGING_CLASS = 'eco-sidebar-dragging'

/**
 * The viewport width the rail must fit inside. Falls back to `Infinity` — which
 * leaves the static ceiling in force — so the clamp stays total in a non-DOM
 * context rather than throwing on a missing `window`.
 * @returns {number}
 */
function currentViewportWidth() {
  return typeof window === 'undefined' ? Infinity : window.innerWidth
}

/**
 * The widest the rail may become on a viewport of `viewportWidth`.
 *
 * The half-viewport cap is what stops a rail persisted on a 2560px monitor from
 * arriving on a 700px laptop and eating most of the window. `Math.max` with the
 * minimum is deliberate: the floor always wins, so this can never return a
 * maximum below `SIDEBAR_MIN_WIDTH` — which would make the clamp unsatisfiable.
 *
 * @param {number} [viewport]
 * @returns {number}
 */
export function sidebarMaxWidth(viewport = currentViewportWidth()) {
  const half = Math.floor(viewport / 2)
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, half))
}

/**
 * Clamp a requested rail width into the allowed range.
 *
 * A non-finite input resolves to the default *through* the clamp, rather than
 * being returned raw. That matters more than it looks: `NaN` is what a corrupt
 * storage entry or an arithmetic slip produces, and it fails silently — it is
 * not `> 0`, so it does not throw, and `marginLeft: NaN` renders as nothing at
 * all, leaving the rail overlapping the content with no error anywhere.
 * Funnelling every path through one clamp means there is no route to a NaN width.
 *
 * @param {number} px
 * @param {number} [viewport]
 * @returns {number}
 */
export function clampSidebarWidth(px, viewport = currentViewportWidth()) {
  const max = sidebarMaxWidth(viewport)
  const value = Number.isFinite(px) ? px : SIDEBAR_DEFAULT_WIDTH
  return Math.round(Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, value)))
}

/**
 * Read the saved rail width.
 *
 * Returns the raw stored number, or `null` when nothing usable is stored —
 * missing key, unreadable `localStorage` (private mode), or a value that does
 * not parse. Range enforcement is deliberately *not* done here: it belongs to
 * `clampSidebarWidth`, and doing it in two places is how they end up disagreeing.
 *
 * @returns {number | null}
 */
export function readPersistedWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (raw === null || raw.trim() === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    // Corrupted or unreadable storage is a clean miss, never a crash.
    return null
  }
}

/**
 * @param {number} px
 * @returns {void}
 */
function writePersistedWidth(px) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(px)))
  } catch {
    /* private mode / quota — the rail still works for this session */
  }
}

/**
 * Owns the rail width: state, clamping, persistence, drag and keyboard control.
 *
 * @returns {{
 *   width: number,
 *   maxWidth: number,
 *   resizing: boolean,
 *   setWidth: (px: number) => void,
 *   startResize: (e: PointerEventOf) => void,
 *   onHandleKeyDown: (e: KeyboardEventOf) => void,
 *   resetWidth: () => void,
 * }}
 */
export function useSidebarWidth() {
  const [width, setWidthState] = useState(() =>
    clampSidebarWidth(readPersistedWidth() ?? SIDEBAR_DEFAULT_WIDTH),
  )
  const [resizing, setResizing] = useState(false)
  // Kept in state rather than derived at render time so `aria-valuemax` and the
  // End key agree with the clamp the pointer path uses, without the component
  // re-deriving the rule from the viewport itself.
  const [maxWidth, setMaxWidth] = useState(() => sidebarMaxWidth())

  // The committed width, readable from inside the drag listeners. They are
  // registered once, at pointerdown, and must not capture a stale `width` from
  // the render that installed them — the same reason `useOutsideClick` keeps its
  // callback in a ref.
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  /** Tears down whatever the in-flight drag installed, or null when idle. */
  const dragCleanup = useRef(/** @type {(() => void) | null} */ (null))

  /** Escape aborts a drag; the hook decides when that is meaningful. */
  const abortRef = useRef(/** @type {(() => void) | null} */ (null))

  // LIFO, so an open dialog still consumes Escape first. The entry is only on the
  // stack while a drag is actually in progress.
  useEscapeToClose(() => abortRef.current?.(), resizing)

  const apply = useCallback(
    /** @param {number} px */
    px => {
      const next = clampSidebarWidth(px)
      setWidthState(next)
      widthRef.current = next
      return next
    },
    [],
  )

  /**
   * Re-clamp when the window itself changes size. Without this, a rail saved
   * wide on a large monitor stays wide after the window shrinks, because the
   * half-viewport cap is only consulted when something asks for a width.
   *
   * The functional update returns the identical number when nothing needs to
   * change, so React bails out of the re-render and this costs nothing on every
   * unrelated resize.
   */
  useEffect(() => {
    /** @returns {void} */
    const reclamp = () => {
      setMaxWidth(sidebarMaxWidth())
      setWidthState(prev => clampSidebarWidth(prev))
    }
    window.addEventListener('resize', reclamp)
    return () => window.removeEventListener('resize', reclamp)
  }, [])

  // A drag interrupted by unmount would otherwise leave its window listeners
  // behind; `pointerup` normally fires and clears them, but unmount is not a
  // pointer event.
  useEffect(() => () => dragCleanup.current?.(), [])

  const setWidth = useCallback(/** @param {number} px */ px => apply(px), [apply])

  const resetWidth = useCallback(() => {
    writePersistedWidth(apply(SIDEBAR_DEFAULT_WIDTH))
  }, [apply])

  const startResize = useCallback(
    /** @param {PointerEventOf} e */
    e => {
      // Primary button, or the single contact point of a touch. A right-click
      // must open the context menu, not start a drag.
      if (e.button !== 0) return
      e.preventDefault()

      const handle = e.currentTarget
      // Capture retargets every later pointer event to the handle, so the drag
      // keeps working while the cursor is over a Leaflet map or the selectable
      // text beside it, and neither of those surfaces ever sees the movement —
      // no map panning, no text selection. Wrapped because jsdom does not
      // implement capture; the window listeners below are the load-bearing path
      // and capture is the refinement, so a missing implementation degrades
      // rather than breaks.
      try {
        handle.setPointerCapture(e.pointerId)
      } catch {
        /* not supported here — window listeners still drive the drag */
      }

      const startX = e.clientX
      const startWidth = widthRef.current
      // The live value is tracked in a closure local so `pointerup` can persist
      // the true final width even when the last rAF commit never ran.
      let latest = startWidth
      /** @type {number | null} */
      let frame = null

      const flush = () => {
        frame = null
        setWidthState(latest)
      }

      /** @param {PointerEvent} ev */
      const onMove = ev => {
        latest = clampSidebarWidth(startWidth + (ev.clientX - startX))
        widthRef.current = latest
        // One state write per paint. A high-polling mouse fires pointermove far
        // above the display rate, and committing each one drops frames — which
        // the user reads as the rail lagging behind the cursor.
        if (frame === null) frame = requestAnimationFrame(flush)
      }

      const finish = () => {
        if (frame !== null) cancelAnimationFrame(frame)
        frame = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        try {
          handle.releasePointerCapture(e.pointerId)
        } catch {
          /* never captured */
        }
        dragCleanup.current = null
        abortRef.current = null
        document.documentElement.classList.remove(DRAGGING_CLASS)
        setResizing(false)
      }

      const onUp = () => {
        // Commit synchronously before tearing down: the final position must not
        // depend on whether a queued frame happened to run.
        setWidthState(latest)
        widthRef.current = latest
        finish()
        // Persist once, on release — not per frame. `localStorage.setItem` is
        // synchronous and blocks the main thread, so writing on every move would
        // reintroduce the jank the rAF throttle above exists to remove.
        writePersistedWidth(latest)
      }

      const abort = () => {
        if (frame !== null) cancelAnimationFrame(frame)
        frame = null
        setWidthState(startWidth)
        widthRef.current = startWidth
        finish()
      }

      dragCleanup.current = finish
      abortRef.current = abort
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      document.documentElement.classList.add(DRAGGING_CLASS)
      setResizing(true)
    },
    [],
  )

  const onHandleKeyDown = useCallback(
    /** @param {KeyboardEventOf} e */
    e => {
      const step = e.shiftKey ? NUDGE_COARSE : NUDGE
      /** @type {number | null} */
      let next = null
      if (e.key === 'ArrowLeft') next = widthRef.current - step
      else if (e.key === 'ArrowRight') next = widthRef.current + step
      else if (e.key === 'Home') next = SIDEBAR_MIN_WIDTH
      else if (e.key === 'End') next = sidebarMaxWidth()
      // Anything else — Tab, Escape, PageDown — keeps its normal meaning. A
      // separator that swallowed every key would be a keyboard trap.
      if (next === null) return

      e.preventDefault()
      setMaxWidth(sidebarMaxWidth())
      // Persisted per press: a keypress is one deliberate, discrete act, so
      // there is no burst here to throttle away.
      writePersistedWidth(apply(next))
    },
    [apply],
  )

  return { width, maxWidth, resizing, setWidth, startResize, onHandleKeyDown, resetWidth }
}
