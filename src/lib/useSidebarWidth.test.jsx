/**
 * Tests for the draggable navigation rail.
 *
 * The rail is the one piece of shell chrome a user can put into an arbitrary
 * state, and two of its failure modes are silent rather than loud:
 *
 *  - a non-finite width renders as *nothing* (`marginLeft: NaN` is dropped), so
 *    the rail overlaps the page with no error anywhere;
 *  - a width restored on a narrower window can swallow half the viewport.
 *
 * Neither shows up as an exception, which is why the clamp is exercised from
 * every direction it can be reached from — pointer, keyboard, storage — rather
 * than just the one the UI happens to use today.
 *
 * Conventions match the other suites here: no `@testing-library/react`, so the
 * hook is driven through a real `createRoot` + `act` harness rather than a
 * render helper.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  clampSidebarWidth,
  readPersistedWidth,
  sidebarMaxWidth,
  useSidebarWidth,
} from './useSidebarWidth'

// The flag React checks to decide whether `act()` is legal. It has to land on
// `globalThis` at runtime; under `checkJs` the declaration below is the only way
// to say so without a `.d.ts` file.
// eslint-disable-next-line no-var
var IS_REACT_ACT_ENVIRONMENT = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** jsdom's default, and what every `sidebarMaxWidth()` call sees unless a test
 *  deliberately narrows it. jsdom has no layout engine, so `innerWidth` is a
 *  value we set rather than one measured from anything. */
const DEFAULT_VIEWPORT = 1024

/** @param {number} px */
function setViewport(px) {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true })
}

/** @param {string} rel */
const readSource = rel => {
  const base = resolve(__dirname, '..', rel)
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    if (existsSync(base + ext)) return readFileSync(base + ext, 'utf8')
  }
  throw new Error(`No source file found for "${rel}" (tried .js .jsx .ts .tsx)`)
}

/**
 * The harness mirrors how `Sidebar` wires the hook — one `width` in, the handle's
 * four behaviours out — and echoes the values it is handed into the DOM so they
 * can be asserted.
 */
function Harness() {
  const { width, maxWidth, resizing, startResize, onHandleKeyDown, resetWidth } = useSidebarWidth()
  return (
    <div>
      <div data-testid="width">{width}</div>
      <div data-testid="max">{maxWidth}</div>
      <div data-testid="resizing">{String(resizing)}</div>
      {/* Same `width` + `minWidth` pair as the real `aside`, so the assertions
          cover the pair rather than half of it. */}
      <div data-testid="rail" style={{ width, minWidth: width }} />
      <button
        type="button"
        data-testid="handle"
        className={`eco-sidebar-resize${resizing ? ' is-dragging' : ''}`}
        onPointerDown={startResize}
        onKeyDown={onHandleKeyDown}
        onDoubleClick={resetWidth}
      />
    </div>
  )
}

/** @type {import('react-dom/client').Root | undefined} */
let root

/** @param {string} testid */
const get = testid => document.querySelector(`[data-testid="${testid}"]`)

/** The hook's current width, as rendered. */
const widthText = () => Number(get('width')?.textContent)

/**
 * A pointer event carrying the fields the hook reads.
 *
 * jsdom's `MouseEvent` has no `pointerId`, and React 19 does not require a real
 * `PointerEvent` to dispatch a `pointerdown` — the type string is what routes it.
 * `button` defaults to 0, which is the primary button the hook insists on.
 *
 * @param {string} type
 * @param {number} clientX
 */
function pointerEvent(type, clientX) {
  const event = new MouseEvent(type, { bubbles: true, clientX })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

/**
 * Press the handle at `x`, move to `x2`, release.
 * @param {number} x
 * @param {number} x2
 */
function dragHandle(x, x2) {
  act(() => {
    get('handle')?.dispatchEvent(pointerEvent('pointerdown', x))
  })
  act(() => {
    window.dispatchEvent(pointerEvent('pointermove', x2))
  })
  act(() => {
    window.dispatchEvent(pointerEvent('pointerup', x2))
  })
}

/**
 * Press the handle with a key.
 * @param {string} key
 * @param {{ shiftKey?: boolean }} [mods]
 */
function pressOnHandle(key, mods = {}) {
  act(() => {
    get('handle')?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }))
  })
}

function render() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Harness />))
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  document.documentElement.classList.remove('eco-sidebar-dragging')
  setViewport(DEFAULT_VIEWPORT)
})

afterEach(() => {
  // The pure-function suites never mount anything, so `root` is still undefined
  // there; only the hook suites have a tree to tear down.
  if (root) act(() => root.unmount())
  root = undefined
  // A test that leaves a drag in flight would otherwise leak the class onto
  // `<html>` for every later test in the file.
  document.documentElement.classList.remove('eco-sidebar-dragging')
  setViewport(DEFAULT_VIEWPORT)
  localStorage.clear()
})

describe('sidebarMaxWidth', () => {
  it('reports the static ceiling on a normal viewport', () => {
    expect(sidebarMaxWidth(DEFAULT_VIEWPORT)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('falls back to half the viewport when that is the smaller of the two', () => {
    // 700 / 2 = 350, below 420, so the viewport wins.
    expect(sidebarMaxWidth(700)).toBe(350)
  })

  it('never reports a ceiling below the floor, however narrow the viewport', () => {
    // 300 / 2 = 150, which the floor has to override: a maximum below the
    // minimum would make the clamp unsatisfiable in both directions.
    expect(sidebarMaxWidth(300)).toBe(SIDEBAR_MIN_WIDTH)
    expect(sidebarMaxWidth(0)).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('treats a missing viewport as unbounded rather than throwing', () => {
    // The non-DOM fallback path in `currentViewportWidth`.
    expect(sidebarMaxWidth(Infinity)).toBe(SIDEBAR_MAX_WIDTH)
  })
})

describe('clampSidebarWidth', () => {
  it('holds the floor', () => {
    expect(clampSidebarWidth(120, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(0, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(-500, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('holds the ceiling', () => {
    expect(clampSidebarWidth(900, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MAX_WIDTH)
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH + 1, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('passes a width already in range through untouched', () => {
    expect(clampSidebarWidth(300, DEFAULT_VIEWPORT)).toBe(300)
    expect(clampSidebarWidth(SIDEBAR_MIN_WIDTH, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, DEFAULT_VIEWPORT)).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('resolves NaN to the default instead of propagating it', () => {
    // The failure this guards: `NaN` is not `> 0`, so nothing throws, and
    // `style={{ width: NaN }}` renders no width at all — the rail would silently
    // collapse onto the content.
    expect(clampSidebarWidth(NaN, DEFAULT_VIEWPORT)).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('resolves the other non-finite inputs to the default too', () => {
    expect(clampSidebarWidth(Infinity, DEFAULT_VIEWPORT)).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(clampSidebarWidth(undefined, DEFAULT_VIEWPORT)).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('rounds sub-pixel drag values', () => {
    // `clientX` is not guaranteed integral, and a fractional width on the rail
    // would not match the integral `marginLeft` beside it.
    expect(clampSidebarWidth(287.4, DEFAULT_VIEWPORT)).toBe(287)
    expect(clampSidebarWidth(287.6, DEFAULT_VIEWPORT)).toBe(288)
  })

  it('re-caps against a narrow viewport', () => {
    // Stored on a wide monitor, restored on a small window.
    expect(clampSidebarWidth(400, 700)).toBe(350)
    expect(clampSidebarWidth(400, 500)).toBe(250)
  })

  it('the floor still wins on a viewport too narrow to have a meaningful cap', () => {
    expect(clampSidebarWidth(400, 300)).toBe(SIDEBAR_MIN_WIDTH)
  })
})

describe('readPersistedWidth', () => {
  it('is null when nothing has been stored', () => {
    expect(readPersistedWidth()).toBeNull()
  })

  it('round-trips a stored number', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '312')
    expect(readPersistedWidth()).toBe(312)
  })

  it('accepts a non-integer and leaves rounding to the clamp', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '305.5')
    expect(readPersistedWidth()).toBe(305.5)
  })

  it('is null for text that does not parse', () => {
    // What a hand-edited or half-written key looks like.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'garbage')
    expect(readPersistedWidth()).toBeNull()
  })

  it('is null for JSON, which is not the format it writes', () => {
    // Guards against a future caller "helpfully" switching the write side to
    // JSON while the read side keeps parsing a bare number.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '{"width":300}')
    expect(readPersistedWidth()).toBeNull()
  })

  it('is null for an empty value rather than treating it as 0', () => {
    // `Number('')` is 0, which is finite — so this needs its own guard, or an
    // emptied key would resolve to the floor instead of the default.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '')
    expect(readPersistedWidth()).toBeNull()
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '   ')
    expect(readPersistedWidth()).toBeNull()
  })

  it('is null, not a throw, when storage itself is unavailable', () => {
    // Private-mode browsers throw from `getItem`. Patched on the prototype and
    // restored in a `finally`, so the throwing stub cannot escape into the next
    // test even if the assertion fails.
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError')
    }
    try {
      expect(readPersistedWidth()).toBeNull()
    } finally {
      Storage.prototype.getItem = original
    }
  })
})

describe('useSidebarWidth — first render', () => {
  it('starts at the default with empty storage', () => {
    render()
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(get('max')?.textContent).toBe(String(SIDEBAR_MAX_WIDTH))
  })

  it('restores a stored width', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '312')
    render()
    expect(widthText()).toBe(312)
  })

  it('clamps a stored width that is over the ceiling', () => {
    // 99999 is what a corrupted key, or a rail dragged on a much wider screen,
    // can produce.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '99999')
    render()
    expect(widthText()).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('clamps a stored width that is under the floor', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '50')
    render()
    expect(widthText()).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('falls back to the default without throwing when the stored value is corrupt', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'not-a-number')
    render()
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('re-caps a stored width against the viewport it is restored on', () => {
    // The scenario: resized wide on a desktop monitor, reopened on a laptop.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '400')
    setViewport(700)
    render()
    expect(widthText()).toBe(350)
  })

  it('renders the same number into width and minWidth', () => {
    // They are one number in the real `aside` too; a mismatch is how flex-shrink
    // gets a chance to desync the rail from the content offset.
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '300')
    render()
    const rail = /** @type {HTMLElement} */ (get('rail'))
    expect(rail.style.width).toBe('300px')
    expect(rail.style.minWidth).toBe('300px')
  })
})

describe('useSidebarWidth — window resize', () => {
  it('re-caps the rail when the window shrinks under it', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '400')
    render()
    expect(widthText()).toBe(400)
    setViewport(500)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(widthText()).toBe(250)
  })

  it('leaves the rail alone when the new viewport still fits it', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '300')
    render()
    setViewport(900)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(widthText()).toBe(300)
  })

  it('widens the reported ceiling when the window grows again', () => {
    // The rail itself stays put — shrinking it is the user's call — but the
    // keyboard path and `aria-valuemax` must not stay capped by an old viewport.
    setViewport(500)
    render()
    expect(get('max')?.textContent).toBe('250')
    setViewport(DEFAULT_VIEWPORT)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(get('max')?.textContent).toBe(String(SIDEBAR_MAX_WIDTH))
  })
})

describe('useSidebarWidth — keyboard', () => {
  it('nudges by 8px with an arrow', () => {
    render()
    pressOnHandle('ArrowRight')
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH + 8)
    pressOnHandle('ArrowLeft')
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('nudges by 32px with Shift held', () => {
    render()
    pressOnHandle('ArrowRight', { shiftKey: true })
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH + 32)
    pressOnHandle('ArrowLeft', { shiftKey: true })
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('jumps to the extremes with Home and End', () => {
    render()
    pressOnHandle('Home')
    expect(widthText()).toBe(SIDEBAR_MIN_WIDTH)
    pressOnHandle('End')
    expect(widthText()).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('cannot be pushed past the floor by holding an arrow', () => {
    render()
    pressOnHandle('Home')
    for (let i = 0; i < 5; i += 1) pressOnHandle('ArrowLeft')
    expect(widthText()).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('cannot be pushed past the ceiling by holding an arrow', () => {
    render()
    pressOnHandle('End')
    for (let i = 0; i < 5; i += 1) pressOnHandle('ArrowRight')
    expect(widthText()).toBe(SIDEBAR_MAX_WIDTH)
  })

  it('honours a viewport-capped End', () => {
    setViewport(700)
    render()
    pressOnHandle('End')
    expect(widthText()).toBe(350)
  })

  it('prevents default only for the keys it consumes', () => {
    render()

    /** @param {string} key */
    const keydown = key => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      act(() => {
        get('handle')?.dispatchEvent(event)
      })
      return event.defaultPrevented
    }

    expect(keydown('ArrowRight')).toBe(true)
    expect(keydown('End')).toBe(true)
    // Tab must keep moving focus, and Escape must keep reaching the escape
    // stack — a separator that swallowed every key would be a keyboard trap.
    expect(keydown('Tab')).toBe(false)
    expect(keydown('Escape')).toBe(false)
  })

  it('persists a keyboard nudge immediately', () => {
    render()
    pressOnHandle('Home')
    // A keypress is one deliberate act, so it is written straight away rather
    // than waiting for a pointer release that will never come.
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(SIDEBAR_MIN_WIDTH))
  })
})

describe('useSidebarWidth — pointer drag', () => {
  it('tracks the pointer 1:1 from wherever the drag started', () => {
    render()
    dragHandle(SIDEBAR_DEFAULT_WIDTH, SIDEBAR_DEFAULT_WIDTH + 60)
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH + 60)
  })

  it('follows the pointer leftwards as well as rightwards', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '300')
    render()
    dragHandle(300, 260)
    expect(widthText()).toBe(260)
  })

  it('clamps at both ends mid-drag', () => {
    render()
    dragHandle(SIDEBAR_DEFAULT_WIDTH, 5000)
    expect(widthText()).toBe(SIDEBAR_MAX_WIDTH)
    dragHandle(SIDEBAR_MAX_WIDTH, -5000)
    expect(widthText()).toBe(SIDEBAR_MIN_WIDTH)
  })

  it('persists once on release', () => {
    render()
    dragHandle(SIDEBAR_DEFAULT_WIDTH, 300)
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('300')
  })

  it('survives a reload at the width it was released at', () => {
    render()
    dragHandle(SIDEBAR_DEFAULT_WIDTH, 330)
    act(() => root.unmount())
    render()
    expect(widthText()).toBe(330)
  })

  it('flags itself as resizing for the duration of the drag', () => {
    render()
    expect(get('resizing')?.textContent).toBe('false')
    act(() => {
      get('handle')?.dispatchEvent(pointerEvent('pointerdown', SIDEBAR_DEFAULT_WIDTH))
    })
    expect(get('resizing')?.textContent).toBe('true')
    expect(get('handle')?.className).toContain('is-dragging')
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', SIDEBAR_DEFAULT_WIDTH))
    })
    expect(get('resizing')?.textContent).toBe('false')
    expect(get('handle')?.className).not.toContain('is-dragging')
  })

  it('holds the resize cursor for the whole drag, not just over the rail', () => {
    render()
    expect(document.documentElement.classList.contains('eco-sidebar-dragging')).toBe(false)
    act(() => {
      get('handle')?.dispatchEvent(pointerEvent('pointerdown', SIDEBAR_DEFAULT_WIDTH))
    })
    // Pointer capture keeps the *events* coming, but the cursor is still picked
    // by hit-testing, so this class is what stops it flickering mid-drag.
    expect(document.documentElement.classList.contains('eco-sidebar-dragging')).toBe(true)
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', SIDEBAR_DEFAULT_WIDTH))
    })
    expect(document.documentElement.classList.contains('eco-sidebar-dragging')).toBe(false)
  })

  it('ignores a non-primary button, so right-click still opens the menu', () => {
    render()
    act(() => {
      get('handle')?.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: SIDEBAR_DEFAULT_WIDTH }),
      )
    })
    expect(get('resizing')?.textContent).toBe('false')
    expect(document.documentElement.classList.contains('eco-sidebar-dragging')).toBe(false)
  })

  it('keeps clamping, rather than throwing, past the window edge', () => {
    render()
    act(() => {
      get('handle')?.dispatchEvent(pointerEvent('pointerdown', SIDEBAR_DEFAULT_WIDTH))
    })
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', -9999))
    })
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', -9999))
    })
    expect(widthText()).toBe(SIDEBAR_MIN_WIDTH)
  })
})

describe('useSidebarWidth — reset', () => {
  it('double-click returns the rail to the default', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '380')
    render()
    expect(widthText()).toBe(380)
    act(() => {
      get('handle')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(widthText()).toBe(SIDEBAR_DEFAULT_WIDTH)
  })

  it('persists the reset, so a reload stays at the default', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '380')
    render()
    act(() => {
      get('handle')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(SIDEBAR_DEFAULT_WIDTH))
  })

  it('clamps the reset against a viewport narrower than the default', () => {
    // 460/2 = 230, below the 244 default, so "reset to default" still has to go
    // through the clamp rather than reinstating a width the window cannot hold.
    setViewport(460)
    render()
    act(() => {
      get('handle')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(widthText()).toBe(230)
  })
})

describe('sidebar width wiring', () => {
  /**
   * The invariant the whole change rests on: the rail's `width` and the content
   * column's `marginLeft` are one value from one hook call. Two `useSidebarWidth()`
   * calls would both compile and both look right, and would desync the instant
   * one of them moved — the drift the old shared constant made impossible, and
   * the reason this is a hook rather than a constant.
   */
  const app = readSource('App')

  it('calls the hook exactly once', () => {
    expect(app.match(/useSidebarWidth\(\)/g) ?? []).toHaveLength(1)
  })

  it('feeds the rail and the content offset from that one value', () => {
    expect(app).toMatch(/width=\{sidebar\.width\}/)
    expect(app).toMatch(/marginLeft: sidebar\.width/)
  })

  it('no longer reads a width constant out of Sidebar', () => {
    // A leftover import would reintroduce a second source for the same number.
    expect(app).not.toMatch(/import Sidebar, \{/)
    expect(app).not.toMatch(/SIDEBAR_WIDTH\b/)
    // Anchored to a statement, not the bare string: Sidebar.jsx's doc comment
    // deliberately quotes the old `export const SIDEBAR_WIDTH = 244` line to
    // explain why it moved, and a substring test would flag that history as a
    // regression.
    expect(readSource('components/Sidebar')).not.toMatch(/^\s*export const SIDEBAR_WIDTH\b/m)
  })

  it('keeps the header utilities that mapStacking.test.js pins', () => {
    // That suite reads this exact string out of App.jsx; recording the dependency
    // here so a future edit to this file has a reason to look there.
    expect(app).toMatch(/sticky top-0 z-\d+/)
  })
})
