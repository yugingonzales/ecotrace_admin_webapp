import { useEffect, useRef, type RefObject } from 'react'

/**
 * Dismiss a popover when the user interacts with anything outside it.
 *
 * Why this exists instead of the usual `<div className="fixed inset-0" onClick=...>`
 * backdrop: the app's `<header>` sets `backdropFilter: 'blur(8px)'`, and a
 * non-`none` backdrop-filter makes that element a **containing block for
 * `position: fixed` descendants**. A `fixed inset-0` backdrop rendered inside
 * that header is therefore sized to the header's own box (~64px tall) instead
 * of the viewport, so it silently fails to catch clicks in the page body. The
 * popover still looked correct — it is `absolute` — which made the bug look
 * like "the click-outside handler is not firing" rather than "the handler is
 * firing on a 64px-tall strip".
 *
 * A document-level listener is immune to containing blocks, and unlike a
 * viewport backdrop it does not swallow clicks or block scrolling on the page
 * underneath — which matters here, because the notification list sits over the
 * Overview stat cards and the user may well want to scroll them.
 *
 * Pass every ref that should count as "inside" — the popover *and* its trigger.
 * Including the trigger is what stops a click on the toggle button from
 * dismissing the popover on `pointerdown` and then re-opening it on `click`.
 */
export function useOutsideClick(
  /** Refs to the elements considered "inside". Ref *objects*, not elements. */
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  active = true,
): void {
  // Held in a ref so callers can pass an inline arrow without re-registering.
  const latest = useRef(onOutside)
  useEffect(() => {
    latest.current = onOutside
  }, [onOutside])

  useEffect(() => {
    if (!active) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      // The refs are stable objects for the component's lifetime, so capturing
      // this array once is safe; only their `.current` changes, and that is read
      // at event time. `refs` is deliberately absent from the dep list.
      if (refs.some(ref => ref.current?.contains(target))) return
      latest.current()
    }

    // Capture phase: the popover closes before the clicked element's own handler
    // runs, so a click that both dismisses and navigates never leaves the
    // popover stuck open behind a new page.
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [active])
}
