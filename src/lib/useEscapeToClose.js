import { useEffect, useRef } from 'react'

/**
 * Close-on-Escape for overlay surfaces (drawers, dropdowns, the decline-reason
 * dialog, the event boundary editor).
 *
 * Handlers live in a LIFO stack behind a single `document` listener, so only the
 * most recently opened surface reacts. That matters for nested overlays: the
 * decline dialog sits on top of the detail drawer, and Escape must close the
 * dialog first — a plain per-component listener would close both at once,
 * because `stopPropagation` does not stop other listeners on the same node.
 */
/** @typedef {{ run: () => void }} EscapeHandler */

/** @type {EscapeHandler[]} */
const stack = []
let attached = false

/** @param {KeyboardEvent} e */
function onKeyDown(e) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (!top) return
  e.stopPropagation()
  top.run()
}

/**
 * @param {() => void} onEscape
 * @param {boolean} [active]
 */
export function useEscapeToClose(onEscape, active = true) {
  // Held in a ref so a caller can pass an inline arrow without re-registering
  // the handler on every render.
  const latest = useRef(onEscape)
  useEffect(() => {
    latest.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    const entry = { run: () => latest.current() }
    stack.push(entry)
    if (!attached) {
      attached = true
      document.addEventListener('keydown', onKeyDown)
    }
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
      if (attached && stack.length === 0) {
        attached = false
        document.removeEventListener('keydown', onKeyDown)
      }
    }
  }, [active])
}

/**
 * Body scroll lock for a full-screen overlay. Kept separate from the escape hook
 * so a component can opt into one without the other. Reference-counted for the
 * same reason as the stack above: nested overlays must not unlock on the way out.
 *
 * @param {boolean} [active]
 */
let lockCount = 0
let previousOverflow = ''

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) document.body.style.overflow = previousOverflow
    }
  }, [active])
}
