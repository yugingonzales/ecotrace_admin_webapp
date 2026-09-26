/**
 * Deep-link plumbing tests.
 *
 * These exist for one specific, real defect: React bails out of a state update
 * that sets the same value, so the original `setFocusTreeTag('TRE-0892')` was a
 * no-op the second time. Clicking a notification that pointed at the row you had
 * just approved therefore worked once and then silently did nothing — the drawer
 * would not reopen. The `nonce` on `NavFocus` exists to defeat exactly that, so
 * the test below pins the identity change rather than the field values: it is the
 * distinctness of the object, not its contents, that makes the destination
 * effect re-run.
 *
 * jsdom has no layout engine, so nothing here asserts what the destination page
 * looks like — only that the instruction handed to it is correct and distinct.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PortalProvider, usePortal } from './store'

/** @typedef {import('./store.js').PortalContextValue} PortalContextValue */

// The flag React checks to decide whether `act()` is legal. It has to be a real
// global at runtime; `declare global` has no JavaScript equivalent, so this is a
// widening — the declared boolean type is no longer checked.
// eslint-disable-next-line no-var
var IS_REACT_ACT_ENVIRONMENT = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** Captures the context so a test can drive `navigate` directly. */
/** @type {PortalContextValue | null} */
let ctx = null
function Probe() {
  ctx = usePortal()
  return null
}

/** @type {HTMLDivElement} */
let container
/** @type {import('react-dom/client').Root} */
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <PortalProvider>
        <Probe />
      </PortalProvider>,
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  ctx = null
})

describe('deep links', () => {
  it('carries the filter the notification announced', () => {
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { status: 'pending' })
    })
    expect(/** @type {PortalContextValue} */ (ctx).active).toBe('submissions')
    expect(/** @type {PortalContextValue} */ (ctx).focus).toMatchObject({ status: 'pending' })
  })

  it('still supports the map view’s tree-tag link', () => {
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { treeTag: 'TRE-0892' })
    })
    expect(/** @type {PortalContextValue} */ (ctx).focus).toMatchObject({ treeTag: 'TRE-0892' })
  })

  it('hands over a fresh object when the same link is followed twice', () => {
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { treeTag: 'TRE-0892' })
    })
    const first = /** @type {NonNullable<PortalContextValue['focus']>} */ (
      /** @type {PortalContextValue} */ (ctx).focus
    )
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { treeTag: 'TRE-0892' })
    })
    const second = /** @type {NonNullable<PortalContextValue['focus']>} */ (
      /** @type {PortalContextValue} */ (ctx).focus
    )

    // The regression: React drops a same-value state update, so without the nonce
    // these would be the identical object and the second click would be a no-op.
    expect(second).not.toBe(first)
    expect(second.nonce).toBeGreaterThan(first.nonce)
  })

  it('clears a pending focus on a plain tab switch', () => {
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { treeTag: 'TRE-0892' })
    })
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('overview')
    })
    expect(/** @type {PortalContextValue} */ (ctx).active).toBe('overview')
    expect(/** @type {PortalContextValue} */ (ctx).focus).toBeNull()
  })

  it('releases the focus once the destination has consumed it', () => {
    act(() => {
      /** @type {PortalContextValue} */ (ctx).navigate('submissions', { status: 'pending' })
    })
    act(() => {
      /** @type {PortalContextValue} */ (ctx).clearFocus()
    })
    expect(/** @type {PortalContextValue} */ (ctx).focus).toBeNull()
  })
})
