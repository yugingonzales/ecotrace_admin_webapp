import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the map/chrome stacking contract described in `index.css`.
 *
 * jsdom has no layout or paint engine, so these tests cannot re-derive which
 * element actually wins. What they can do is pin the two facts the fix rests
 * on, so the bug cannot silently come back:
 *
 *  1. both map roots carry the class that makes them a stacking context, and
 *  2. the stylesheet keeps `isolation: isolate` on exactly those classes.
 *
 * A comment in a stylesheet is not a guarantee. This is the closest thing to
 * one that a test runner can give us.
 */

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

const css = read('index.css')
const mapViewSrc = read('components/modules/MapView.tsx')
const editorSrc = read('components/map/EventBoundaryEditor.tsx')
const appSrc = read('App.tsx')

/**
 * Minimal CSS rule parser. Comments are stripped first, otherwise a comment
 * that merely *mentions* a z-index is indistinguishable from a rule that sets
 * one — which is exactly the mistake this test made on its first run.
 */
const blocks = (() => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    declarations: m[2],
  }))
})()

/** `isolation: isolate` is declared for `selector`, ignoring comments. */
const isolates = (selector: string) =>
  blocks.some(
    b =>
      /isolation:\s*isolate/.test(b.declarations) &&
      b.selector.split(',').some(s => s.trim() === selector),
  )

/** Every class in the stylesheet declared `isolation: isolate`. */
const isolatedClasses = new Set(
  blocks
    .filter(b => /isolation:\s*isolate/.test(b.declarations))
    .flatMap(b => b.selector.split(',').map(s => s.trim()))
    .filter(s => s.startsWith('.')),
)

/** Every source file that mounts a Leaflet map. */
const MAP_FILES = ['components/modules/MapView.tsx', 'components/map/EventBoundaryEditor.tsx']

describe('map stacking context', () => {
  it('isolates the Map page mini map (.map-card)', () => {
    expect(mapViewSrc).toMatch(/className="card overflow-hidden relative map-card"/)
    expect(isolates('.map-card')).toBe(true)
  })

  it('isolates the Events page mini map (.cc-event-map)', () => {
    expect(editorSrc).toMatch(/className="cc-event-map"/)
    expect(isolates('.cc-event-map')).toBe(true)
  })

  it('isolates the fullscreen boundary editor map (.cc-map-body)', () => {
    expect(editorSrc).toMatch(/className="cc-map-body cc-draw-mode relative"/)
    expect(isolates('.cc-map-body')).toBe(true)
  })

  /**
   * The tripwire. The first version of this file asserted exactly two map roots,
   * because two is what the author had found by reading — and it stayed green
   * while `.cc-event-map`, the worst of the three, was still leaking at z-1000.
   * A test that encodes an unchecked assumption is worse than no test, because
   * it manufactures confidence that was never earned.
   *
   * So: discover the roots rather than list them. Any file that mounts a
   * `<MapContainer>` must contain at least one isolated container. A new map
   * added without an isolation rule fails here.
   */
  it('isolates every component that mounts a Leaflet map', () => {
    expect(isolatedClasses.size).toBeGreaterThan(0)

    for (const rel of MAP_FILES) {
      const src = read(rel)
      if (!src.includes('<MapContainer')) continue
      const used = [...src.matchAll(/className="([^"]*)"/g)]
        .flatMap(m => m[1].split(/\s+/))
        .filter(c => isolatedClasses.has('.' + c))
      expect(used, `${rel} mounts a map but nothing in it is isolated`).not.toEqual([])
    }
  })

  it('has no isolation rule that no component uses', () => {
    const everySource = [...MAP_FILES, 'App.tsx'].map(read).join('\n')
    const orphan = [...isolatedClasses].filter(cls => !everySource.includes(cls.slice(1)))
    expect(orphan).toEqual([])
  })

  it('keeps the high z-index rules scoped inside a map root', () => {
    // The only declarations in our own CSS above the header's 30. The first
    // three render *inside* a map root, so `isolation: isolate` contains them;
    // the last two are app overlays that are meant to cover the header. Leaflet's
    // own 200-1000 live in node_modules and are contained by the same isolation.
    const aboveHeader = blocks
      .map(b => ({ selector: b.selector, z: Number(b.declarations.match(/z-index:\s*(\d+)/)?.[1]) }))
      .filter(b => b.z > 30)
      .map(b => `${b.selector} -> ${b.z}`)
      .sort()

    expect(aboveHeader).toEqual([
      '.cc-boundary-hint -> 1000',
      '.cc-grip-layer -> 800',
      '.map-expand-btn -> 500',
      '.overlay -> 50',
      '.overlay-map -> 70',
    ])
  })
})

describe('header stacking', () => {
  const headerZ = () => Number(appSrc.match(/sticky top-0 z-(\d+)/)?.[1])

  it('is a positive z-index so it paints above the z-auto map roots', () => {
    expect(headerZ()).toBeGreaterThan(0)
  })

  /**
   * Deliberate invariant, and the reason requirement 1 was *not* implemented by
   * raising the header above Leaflet's 1000. The only things separating the
   * header from that number are the app's own overlays:
   *
   *   SubmissionsView drawer   z-40
   *   .overlay (dialogs)       z-50
   *   .overlay-map (map)       z-70
   *
   * A modal deliberately covers the header, which also means the bell and
   * avatar cannot be clicked while one is open — so a popover never has to
   * outrank a modal. Lifting the header past 1000 to beat Leaflet would push
   * it over the drawer and those overlays, letting the 64px header bar paint
   * across the drawer's title row. `isolation: isolate` on the map roots
   * removes the need for that trade entirely.
   */
  it('stays below the app overlays it must never cover', () => {
    expect(headerZ()).toBeLessThan(40)
  })
})
