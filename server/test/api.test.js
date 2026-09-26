/**
 * Cross-check the live API against src/lib/trees.ts.
 *
 * This is the test that matters. Everything else in the repo - MapView markers,
 * the Flutter campusTrees list, the admin's filter dropdowns - renders from
 * trees.ts, so the database drifting away from that file would desync all three
 * consumers at once. The log already records one instance of exactly this bug
 * (a zone-naming divergence), so it is asserted rather than assumed.
 *
 * Requires the API on :3000 and a seeded database. Skips loudly if either is
 * absent, so it never reports a false pass.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.API_BASE ?? 'http://localhost:3000'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const STATUS_MAP = { verified: 'verified', pending: 'pending', incident: 'incident', unverified: 'unverified' }

/** Same extraction the seed generator uses, so the two cannot diverge. */
function readTrees() {
  const source = readFileSync(resolve(repoRoot, 'src', 'lib', 'trees.ts'), 'utf8')
  const pattern = /\{\s*id:\s*'([^']+)'\s*,\s*lat:\s*(-?[\d.]+)\s*,\s*lng:\s*(-?[\d.]+)\s*,\s*status:\s*'(\w+)'\s*,\s*staffName:\s*'([^']+)'\s*,\s*species:\s*'([^']+)'\s*,\s*datePlanted:\s*'[^']+'\s*,\s*plantedIso:\s*'(\d{4}-\d{2}-\d{2})'\s*,\s*treeTag:\s*'([^']+)'\s*,\s*zone:\s*'([^']+)'\s*\}/g
  const trees = []
  let m
  while ((m = pattern.exec(source)) !== null) {
    const [, id, lat, lng, status, staffName, species, plantedIso, treeTag, zone] = m
    trees.push({ treeCode: treeTag, lat: Number(lat), lng: Number(lng), status, staffName, species, plantedIso, zone })
  }
  return trees
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { status: res.status, body: await res.json() }
}

// Fail fast and clearly rather than reporting 23 confusing assertion errors.
const reachable = await fetch(`${BASE}/api/health`)
  .then((r) => r.ok)
  .catch(() => false)

const fixtures = reachable ? readTrees() : []

test('API is reachable', { skip: !reachable && 'API not running on ' + BASE }, () => {
  assert.ok(reachable)
})

test('trees.ts still yields 23 rows', { skip: !reachable }, () => {
  assert.equal(fixtures.length, 23, 'trees.ts is the source of truth; if this changed, update the seed too')
})

test('GET /api/plants returns every tree in trees.ts', { skip: !reachable }, async () => {
  const { status, body } = await get('/api/plants')
  assert.equal(status, 200)
  assert.equal(body.total, 23)
  assert.equal(body.items.length, 23)
})

test('every tree matches on every field the UIs read', { skip: !reachable }, async () => {
  const { body } = await get('/api/plants')
  const byCode = new Map(body.items.map((p) => [p.tree_code, p]))

  for (const t of fixtures) {
    const row = byCode.get(t.treeCode)
    assert.ok(row, `${t.treeCode} missing from API response`)
    assert.equal(row.latitude, t.lat, `${t.treeCode} lat`)
    assert.equal(row.longitude, t.lng, `${t.treeCode} lng`)
    assert.equal(row.zone_name, t.zone, `${t.treeCode} zone`)
    assert.equal(row.plant_species, t.species, `${t.treeCode} species`)
    // The exact string, not a Date - this is the timezone regression guard.
    assert.equal(row.planted_date, t.plantedIso, `${t.treeCode} plantedIso (timezone drift?)`)
    assert.equal(row.plant_status, STATUS_MAP[t.status], `${t.treeCode} status mapping`)
  }
})

test('status filter is a true partition: sums back to 23', { skip: !reachable }, async () => {
  const { body: all } = await get('/api/plants')
  const seen = new Set()
  let total = 0
  for (const status of ['pending', 'verified', 'incident', 'deceased', 'unverified']) {
    const { body } = await get(`/api/plants?status=${status}`)
    for (const p of body.items) {
      assert.equal(p.plant_status, status)
      assert.ok(!seen.has(p.tree_code), `${p.tree_code} returned by two status filters`)
      seen.add(p.tree_code)
    }
    total += body.total
  }
  assert.equal(total, all.total)
})

test('zone filter is a true partition: sums back to 23', { skip: !reachable }, async () => {
  let total = 0
  const seen = new Set()
  for (const zone of ['Zone I', 'Zone II', 'Zone III']) {
    const { body } = await get(`/api/plants?zone=${encodeURIComponent(zone)}`)
    for (const p of body.items) {
      assert.equal(p.zone_name, zone)
      seen.add(p.tree_code)
    }
    total += body.total
  }
  assert.equal(total, 23)
  assert.equal(seen.size, 23)
})

test('the 4 incident trees survived the seed', { skip: !reachable }, async () => {
  const expected = fixtures.filter((t) => t.status === 'incident').map((t) => t.treeCode)
  assert.equal(expected.length, 4)
  const { body } = await get('/api/plants?status=incident')
  assert.deepEqual(body.items.map((p) => p.tree_code).sort(), expected.sort())
})

test('invalid input is rejected with 400, not executed', { skip: !reachable }, async () => {
  for (const q of ['?status=bogus', '?status=verified%27%20OR%201%3D1--', '?minLat=12.5', '?sort=id;DROP+TABLE+ecotrace_plants', '?dir=sideways']) {
    const { status } = await get(`/api/plants${q}`)
    assert.equal(status, 400, `${q} should be rejected`)
  }
})

test('unknown plant and unknown route both 404', { skip: !reachable }, async () => {
  assert.equal((await get('/api/plants/TRE-9999')).status, 404)
  assert.equal((await get('/api/nope')).status, 404)
})

test('lookup works by numeric id and by tag', { skip: !reachable }, async () => {
  const { body: all } = await get('/api/plants')
  const first = all.items[0]
  const byId = await get(`/api/plants/${first.plant_id}`)
  const byCode = await get(`/api/plants/${first.tree_code}`)
  assert.equal(byId.body.tree_code, first.tree_code)
  assert.equal(byCode.body.plant_id, first.plant_id)
})

test('the four fixture statuses stay distinct (no status collapse)', { skip: !reachable }, async () => {
  // Regression guard. An earlier draft mapped `unverified` onto `pending` as the
  // nearest available ENUM value. Nothing in the API broke: the total stayed 23,
  // every field still matched, and the tests passed. But MapView renders
  // `pending` orange and `unverified` grey and counts them separately, so the
  // map would have drawn 8 orange pins where the fixture has 6 orange + 2 grey.
  // Asserting per-status counts is what makes that class of loss visible.
  const expected = { verified: 11, pending: 6, incident: 4, unverified: 2 }
  const { body } = await get('/api/plants/facets')
  const actual = Object.fromEntries(body.statuses.map((s) => [s.value, s.count]))

  for (const [status, count] of Object.entries(expected)) {
    assert.equal(actual[status], count, `expected ${count} ${status} trees`)
  }
  assert.equal(body.total, 23)
  assert.equal(
    Object.values(actual).reduce((a, b) => a + b, 0),
    23,
    'every tree must land in exactly one status bucket',
  )
})

test('pagination is consistent with total and page size', { skip: !reachable }, async () => {
  const { body } = await get('/api/plants?page=2&pageSize=10')
  assert.equal(body.page, 2)
  assert.equal(body.pageSize, 10)
  assert.equal(body.total, 23, 'total must count matches, not the current page')
  assert.equal(body.items.length, 10)

  // Pages must tile the set with no overlap and nothing dropped.
  const seen = new Set()
  for (const page of [1, 2, 3]) {
    const { body: p } = await get(`/api/plants?page=${page}&pageSize=10`)
    for (const row of p.items) {
      assert.ok(!seen.has(row.tree_code), `${row.tree_code} on two pages`)
      seen.add(row.tree_code)
    }
  }
  assert.equal(seen.size, 23)

  // A page past the end is empty, not an error.
  assert.equal((await get('/api/plants?page=99&pageSize=10')).body.items.length, 0)
})

test('out-of-range pagination params are rejected', { skip: !reachable }, async () => {
  for (const q of ['?page=0', '?page=-1', '?pageSize=0', '?pageSize=100000', '?page=abc']) {
    assert.equal((await get(`/api/plants${q}`)).status, 400, `${q} should be rejected`)
  }
})
