/**
 * EcoTrace read-only API.
 *
 * Scope is deliberately narrow: three GET routes over ecotrace_plants plus a
 * health probe. No auth, no writes. Verification push, EcoTag sync and the
 * dead-tree reconciliation loop are explicitly deferred - adding a write path
 * here is the point at which this stops being a safe thing to expose, so it
 * should be a separate, deliberate decision rather than an extension of this file.
 */
import express from 'express'
import { z } from 'zod'
import { ping, closePool } from './db.js'
import { listPlants, getPlantById, getPlantByCode, getFacets } from './plants.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3000)

app.disable('x-powered-by')

// ── Query validation ────────────────────────────────────────────────────────
// zod parses the raw query string into typed values. Anything that fails this
// never reaches SQL, which is what keeps listPlants' parameterised query honest
// even though it accepts a variable number of filters.
const StatusEnum = z.enum(['pending', 'verified', 'deceased', 'incident', 'unverified'])
const ZoneEnum = z.enum(['Zone I', 'Zone II', 'Zone III'])
const SortEnum = z.enum(['id', 'code', 'zone', 'date', 'status'])
const DirEnum = z.enum(['asc', 'desc'])

const coord = z.coerce.number().min(-90).max(90)
const lonCoord = z.coerce.number().min(-180).max(180)

const listQuery = z.object({
  // Comma-separated lists: ?status=verified,pending
  status: z.string().optional().transform((v) => v?.split(',').filter(Boolean)).pipe(z.array(StatusEnum).optional()),
  zone: z.string().optional().transform((v) => v?.split(',').filter(Boolean)).pipe(z.array(ZoneEnum).optional()),
  // Viewport bounds. All four are required together - a partial box would be
  // silently ignored, which would return the whole table and look like a bug.
  minLat: coord.optional(),
  maxLat: coord.optional(),
  minLng: lonCoord.optional(),
  maxLng: lonCoord.optional(),
  sort: SortEnum.default('code'),
  dir: DirEnum.default('asc'),
  // Pagination is part of the Paginated<T> contract in types.ts, so it is
  // validated here rather than clamped silently in the query layer.
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
})

/** 400 for anything the client can fix, without leaking a stack trace. */
function parseOr400(schema, input, res) {
  const result = schema.safeParse(input)
  if (!result.success) {
    res.status(400).json({
      error: 'invalid_query',
      message: 'One or more query parameters are invalid.',
      details: result.error.issues.map((i) => ({ param: i.path.join('.') || '(root)', message: i.message })),
    })
    return null
  }
  return result.data
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  const db = await ping()
  // 200 when the process is up even if the DB is down: the liveness signal and
  // the readiness signal are different questions, and conflating them makes
  // orchestrator restarts fire on every transient database blip.
  res.status(200).json({
    status: 'ok',
    service: 'ecotrace-api',
    database: db,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/plants', async (req, res, next) => {
  try {
    const query = parseOr400(listQuery, req.query, res)
    if (!query) return

    const boundsKeys = ['minLat', 'maxLat', 'minLng', 'maxLng']
    const provided = boundsKeys.filter((k) => query[k] !== undefined)
    if (provided.length > 0 && provided.length < boundsKeys.length) {
      return res.status(400).json({
        error: 'invalid_query',
        message: `bounds require all four of ${boundsKeys.join(', ')}`,
      })
    }
    if (provided.length === 4 && query.minLat > query.maxLat) {
      return res.status(400).json({ error: 'invalid_query', message: 'minLat must not exceed maxLat' })
    }
    if (provided.length === 4 && query.minLng > query.maxLng) {
      return res.status(400).json({ error: 'invalid_query', message: 'minLng must not exceed maxLng' })
    }

    const bounds =
      provided.length === 4
        ? { minLat: query.minLat, maxLat: query.maxLat, minLng: query.minLng, maxLng: query.maxLng }
        : undefined

    const result = await listPlants({
      statuses: query.status,
      zones: query.zone,
      bounds,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
    })
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.get('/api/plants/facets', async (_req, res, next) => {
  try {
    res.json(await getFacets())
  } catch (error) {
    next(error)
  }
})

// Accepts either the numeric plant_id or the TRE-#### tag, because the apps
// identify trees by tag everywhere and only the database knows the surrogate key.
app.get('/api/plants/:idOrCode', async (req, res, next) => {
  try {
    const { idOrCode } = req.params
    const isNumeric = /^\d+$/.test(idOrCode)
    const plant = isNumeric ? await getPlantById(Number(idOrCode)) : await getPlantByCode(idOrCode)
    if (!plant) {
      return res.status(404).json({ error: 'not_found', message: `No plant matches '${idOrCode}'.` })
    }
    res.json(plant)
  } catch (error) {
    next(error)
  }
})

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'No such route.' })
})

// Central error handler. Logs server-side, returns a generic message to the
// client - SQL text and connection details do not belong in an HTTP response.
app.use((error, _req, res, _next) => {
  console.error('[ecotrace-api] unhandled error:', error)
  res.status(500).json({ error: 'internal_error', message: 'Unexpected server error.' })
})

const server = app.listen(PORT, () => {
  console.log(`[ecotrace-api] listening on http://localhost:${PORT}`)
})

// Close the pool on shutdown so in-flight requests drain instead of the
// process dropping sockets out from under them.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await closePool()
      process.exit(0)
    })
  })
}

export { app }
