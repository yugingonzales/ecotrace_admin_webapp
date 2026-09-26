/**
 * Regenerate `server/migrations/002_seed_plants.sql` from `src/lib/trees.ts`.
 *
 * Run:  node server/scripts/generate-seed.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const treesPath = resolve(repoRoot, 'src', 'lib', 'trees.ts')
const outPath = resolve(repoRoot, 'server', 'migrations', '002_seed_plants.sql')

// StatusKey -> plant_status. Now 1:1 for all four admin statuses. The ENUM was
// widened across migrations 001 and 002 so that no value is approximated; an
// earlier draft mapped `unverified` onto `pending`, which the UI would have
// rendered as 8 orange pins instead of 6 orange + 2 grey.
const STATUS_MAP = {
  verified: 'verified',
  pending: 'pending',
  incident: 'incident',
  unverified: 'unverified',
}
const VERIFIED_COUNTS = { verified: 1, pending: 0, incident: 0, unverified: 0 }

function fail(message) { console.error(`generate-seed: ${message}`); process.exit(1) }

const source = readFileSync(treesPath, 'utf8')
const rowPattern = /\{\s*id:\s*'([^']+)'\s*,\s*lat:\s*(-?[\d.]+)\s*,\s*lng:\s*(-?[\d.]+)\s*,\s*status:\s*'(\w+)'\s*,\s*staffName:\s*'([^']+)'\s*,\s*species:\s*'([^']+)'\s*,\s*datePlanted:\s*'([^']+)'\s*,\s*plantedIso:\s*'(\d{4}-\d{2}-\d{2})'\s*,\s*treeTag:\s*'([^']+)'\s*,\s*zone:\s*'([^']+)'\s*\}/g

const trees = []
let match
while ((match = rowPattern.exec(source)) !== null) {
  const [, id, lat, lng, status, staffName, species, , plantedIso, treeTag, zone] = match
  if (!Object.hasOwn(STATUS_MAP, status)) fail(`unknown status '${status}' on ${id}`)
  if (id !== treeTag) fail(`id '${id}' disagrees with treeTag '${treeTag}'`)
  trees.push({ treeCode: treeTag, zone, lat: Number(lat).toFixed(8), lng: Number(lng).toFixed(8), plantedIso, species, status, staffName })
}
if (trees.length === 0) fail('matched 0 trees')
const codes = new Set(trees.map(t=>t.treeCode))
if (codes.size !== trees.length) fail('duplicate treeCode found')

const counts = trees.reduce((acc,t)=>({...acc,[t.status]:(acc[t.status]??0)+1}),{})
const rows = trees.map(t=>`  ('${t.treeCode}','${t.zone}',${t.lat},${t.lng},'${t.plantedIso}','${t.species}','${STATUS_MAP[t.status]}',${VERIFIED_COUNTS[t.status]},'${t.staffName}')`).join(',\n')

const header = `-- GENERATED FILE - do not hand-edit.
-- Source:     src/lib/trees.ts  (the authoritative mock inventory)
-- Generator:  server/scripts/generate-seed.mjs
-- Regenerate: node server/scripts/generate-seed.mjs
--
-- Seeds the ${trees.length} UEP Catarman trees. Idempotent: keyed on the UNIQUE
-- tree_code column added in migration 001.
--
-- STATUS MAPPING (StatusKey -> plant_status): 1:1 for all four values.
--   The ENUM was widened by migrations 001 and 002 to make this exact, so the
--   map layer's per-status pin colours and counts survive the round-trip.
--   Counts: ${Object.entries(counts).sort().map(([k,v])=>`${k}=${v}`).join(', ')}
--
-- planter_name is parked in location_address because the table has no planter
-- column. That reuses a semantically wrong field and is the one line here that
-- should not ship to production. Acceptable for a dev seed only.

INSERT INTO ecotrace_plants`

const sql = `${header}
  (tree_code, zone_name, latitude, longitude, planted_date, plant_species, plant_status, verification_count, location_address)
VALUES
${rows}
ON DUPLICATE KEY UPDATE zone_name=VALUES(zone_name),latitude=VALUES(latitude),longitude=VALUES(longitude),planted_date=VALUES(planted_date),plant_species=VALUES(plant_species),plant_status=VALUES(plant_status),verification_count=VALUES(verification_count),location_address=VALUES(location_address);
`

writeFileSync(outPath, sql, 'utf8')
console.log(`wrote ${trees.length} trees`)
