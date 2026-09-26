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
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PortalProvider, usePortal, type PortalContextValue } from './store'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** Captures the context so a test can drive `navigate` directly. */
let ctx: PortalContextValue | null = null
function Probe() {
  ctx = usePortal()
  return null
}

let container: HTMLDivElement
let root: Root

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
      ctx!.navigate('submissions', { status: 'pending' })
    })
    expect(ctx!.active).toBe('submissions')
    expect(ctx!.focus).toMatchObject({ status: 'pending' })
  })

  it('still supports the map view’s tree-tag link', () => {
    act(() => {
      ctx!.navigate('submissions', { treeTag: 'TRE-0892' })
    })
    expect(ctx!.focus).toMatchObject({ treeTag: 'TRE-0892' })
  })

  it('hands over a fresh object when the same link is followed twice', () => {
    act(() => {
      ctx!.navigate('submissions', { treeTag: 'TRE-0892' })
    })
    const first = ctx!.focus
    act(() => {
      ctx!.navigate('submissions', { treeTag: 'TRE-0892' })
    })
    const second = ctx!.focus

    // The regression: React drops a same-value state update, so without the nonce
    // these would be the identical object and the second click would be a no-op.
    expect(second).not.toBe(first)
    expect(second!.nonce).toBeGreaterThan(first!.nonce)
  })

  it('clears a pending focus on a plain tab switch', () => {
    act(() => {
      ctx!.navigate('submissions', { treeTag: 'TRE-0892' })
    })
    act(() => {
      ctx!.navigate('overview')
    })
    expect(ctx!.active).toBe('overview')
    expect(ctx!.focus).toBeNull()
  })

  it('releases the focus once the destination has consumed it', () => {
    act(() => {
      ctx!.navigate('submissions', { status: 'pending' })
    })
    act(() => {
      ctx!.clearFocus()
    })
    expect(ctx!.focus).toBeNull()
  })
})
