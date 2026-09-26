/**
 * Regression tests for the header popover dismissal.
 *
 * These exist because of a real, reported bug: the notification panel would not
 * retract on an outside click. The cause was not the handler — it was the
 * `<div className="fixed inset-0" onClick={...}>` backdrop, which sat inside a
 * `<header>` carrying `backdropFilter: 'blur(8px)'`. Per spec, a non-`none`
 * backdrop-filter makes the element a containing block for `position: fixed`
 * descendants, so that "full-viewport" backdrop was really a 64px-tall strip
 * confined to the header. The popover stayed open because nothing outside the
 * header was ever clickable.
 *
 * The first test below reproduces that DOM shape. Note that jsdom has no layout
 * engine, so these tests cannot re-derive the containing-block rule themselves;
 * what they lock in is that dismissal no longer depends on a positioned
 * element's containing block at all.
 */
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useOutsideClick } from './useOutsideClick'

// The flag React checks to decide whether `act()` is legal. It has to land on
// `globalThis` at runtime; under `checkJs` the declaration below is the only
// way to say so without a `.d.ts` file.
// eslint-disable-next-line no-var
var IS_REACT_ACT_ENVIRONMENT = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/**
 * jsdom has no PointerEvent in some versions; the hook only reads `target`.
 * @param {Node} node
 */
function pointerDown(node) {
  const Ctor = /** @type {{ PointerEvent?: typeof MouseEvent }} */ (globalThis).PointerEvent
  const event = Ctor
    ? new Ctor('pointerdown', { bubbles: true })
    : new MouseEvent('pointerdown', { bubbles: true })
  act(() => {
    node.dispatchEvent(event)
  })
}

/**
 * Mirrors the header: a popover plus its trigger, both inside an element with
 * `backdropFilter`, with unrelated "page content" living outside that element.
 */
function Popover() {
  const [open, setOpen] = useState(true)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  useOutsideClick([panelRef, triggerRef], () => setOpen(false), open)

  return (
    <div data-testid="header" style={{ backdropFilter: 'blur(8px)' }}>
      <button ref={triggerRef} data-testid="trigger" onClick={() => setOpen(v => !v)}>
        bell
      </button>
      {open && (
        <div ref={panelRef} data-testid="panel">
          notifications
        </div>
      )}
    </div>
  )
}

/** @type {import('react-dom/client').Root} */
let root
let mounted = true
/** @type {HTMLElement} */
let pageContent

/** @param {string} testid */
const get = testid => document.querySelector(`[data-testid="${testid}"]`)

beforeEach(() => {
  document.body.innerHTML = ''
  const container = document.createElement('div')
  document.body.appendChild(container)
  // The stat cards / table the panel visually overlaps.
  pageContent = document.createElement('div')
  pageContent.setAttribute('data-testid', 'page-content')
  document.body.appendChild(pageContent)

  mounted = true
  root = createRoot(container)
  act(() => root.render(<Popover />))
})

afterEach(() => {
  if (mounted) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('useOutsideClick', () => {
  it('dismisses on a click outside, even inside a backdrop-filter ancestor', () => {
    // The reported bug: a `fixed inset-0` backdrop here would be clamped to the
    // header, so this click would never reach it.
    expect(get('panel')).not.toBeNull()

    pointerDown(pageContent)

    expect(get('panel')).toBeNull()
  })

  it('dismisses on a click anywhere in the document, not just the page body', () => {
    pointerDown(document.body)
    expect(get('panel')).toBeNull()
  })

  it('stays open when the click lands inside the panel', () => {
    pointerDown(/** @type {Node} */ (get('panel')))
    expect(get('panel')).not.toBeNull()
  })

  it('stays open when the click lands on the trigger, so the toggle still works', () => {
    // Guards the capture-phase ordering: if the trigger were treated as
    // "outside", the hook would dismiss on pointerdown and the button's own
    // onClick would immediately re-open the panel.
    pointerDown(/** @type {Node} */ (get('trigger')))
    expect(get('panel')).not.toBeNull()

    act(() => {
      ;/** @type {HTMLButtonElement} */ (get('trigger')).click()
    })
    expect(get('panel')).toBeNull()
  })

  it('removes its document listener on unmount', () => {
    expect(get('panel')).not.toBeNull()
    act(() => root.unmount())
    mounted = false

    // The listener is gone, so this is inert rather than a call into an
    // unmounted component. `pointerDown` throwing would fail the test.
    pointerDown(pageContent)
    expect(get('panel')).toBeNull()
  })
})
