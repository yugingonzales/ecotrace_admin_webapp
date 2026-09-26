/**
 * Read queries for ecotrace_plants.
 *
 * Every query is parameterised - no string interpolation of user input into
 * SQL, including the dynamic ORDER BY, which is validated against a whitelist
 * before it reaches the statement text.
 */
import { pool } from './db.js'

/**
 * SELECT list -> the `Plant` interface in src/lib/types.ts.
 *
 * Column names are the raw InnoDB names on purpose. types.ts already declares
 * `Plant` against the real schema, so renaming to camelCase here would force
 * every consumer to translate twice - once from the wire, once from `Plant` to
 * the `TreeMarker` shape MapView renders. One boundary, in the UI.
 *
 * `tree_code` and `zone_name` are the two columns added by migration 001; the
 * interface was extended to match.
 */
const SELECT = `
  SELECT plant_id,
         tree_code,
         zone_name,
         latitude,
         longitude,
         location_address,
         -- DATE_FORMAT is required, not cosmetic. mysql2 decodes a DATE into a JS
         -- Date at LOCAL midnight and JSON.stringify then renders it as UTC, which on
         -- a UTC+8 host shifts every planted date back a day (2026-03-12 becomes
         -- 2026-03-11T16:00:00.000Z). types.ts declares planted_date as a plain
         -- 'YYYY-MM-DD' string, so emit exactly that and skip the round-trip.
         DATE_FORMAT(planted_date, '%Y-%m-%d') AS planted_date,
         plant_species,
         plant_status,
         verification_count,
         last_verified_at,
         created_by,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM ecotrace_plants`

/** Whitelist for ORDER BY. Never interpolate raw user input. */
const SORTABLE = {
  id: 'plant_id',
  code: 'tree_code',
  zone: 'zone_name',
  date: 'planted_date',
  status: 'plant_status',
}

/**
 * @param {object} filters
 * @param {string[]} filters.statuses  plant_status values
 * @param {string[]} filters.zones     zone_name values
 * @param {{minLat,maxLat,minLng,maxLng}} [filters.bounds]
 * @param {string} [filters.sort]      key of SORTABLE
 * @param {'asc'|'desc'} [filters.dir]
 */
export async function listPlants({ statuses, zones, bounds, sort = 'code', dir = 'asc', page = 1, pageSize = 50 } = {}) {
  const where = []
  const params = []

  if (statuses?.length) {
    where.push(`plant_status IN (${statuses.map(() => '?').join(',')})`)
    params.push(...statuses)
  }
  if (zones?.length) {
    where.push(`zone_name IN (${zones.map(() => '?').join(',')})`)
    params.push(...zones)
  }
  if (bounds) {
    // Bounds filtering is what makes a viewport query cheap: idx_coordinates
    // covers (latitude, longitude) so the range scan stays indexed.
    where.push('latitude BETWEEN ? AND ?')
    params.push(bounds.minLat, bounds.maxLat)
    where.push('longitude BETWEEN ? AND ?')
    params.push(bounds.minLng, bounds.maxLng)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderColumn = SORTABLE[sort] ?? SORTABLE.code
  const direction = dir === 'desc' ? 'DESC' : 'ASC'

  // total is a separate COUNT rather than rows.length, because pageSize is
  // applied by SQL. Returning rows.length as total would make every partial
  // page look like the last one and break the admin's pager.
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ecotrace_plants ${whereSql}`, params)
  const offset = (page - 1) * pageSize

  const [rows] = await pool.query(
    `${SELECT} ${whereSql} ORDER BY ${orderColumn} ${direction} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  // The `Paginated<T>` envelope declared in src/lib/types.ts.
  return { items: rows, total, page, pageSize }
}

export async function getPlantById(id) {
  const [rows] = await pool.query(`${SELECT} WHERE plant_id = ? LIMIT 1`, [id])
  return rows[0] ?? null
}

export async function getPlantByCode(code) {
  const [rows] = await pool.query(`${SELECT} WHERE tree_code = ? LIMIT 1`, [code])
  return rows[0] ?? null
}

/** Distinct values, for populating the admin's filter dropdowns from real data. */
export async function getFacets() {
  const [statuses] = await pool.query(
    'SELECT DISTINCT plant_status AS value, COUNT(*) AS count FROM ecotrace_plants GROUP BY plant_status ORDER BY plant_status',
  )
  const [zones] = await pool.query(
    'SELECT DISTINCT zone_name AS value, COUNT(*) AS count FROM ecotrace_plants WHERE zone_name IS NOT NULL GROUP BY zone_name ORDER BY zone_name',
  )
  const [total] = await pool.query('SELECT COUNT(*) AS count FROM ecotrace_plants')
  return {
    total: total[0]?.count ?? 0,
    statuses: statuses.map((r) => ({ value: r.value, count: r.count })),
    zones: zones.map((r) => ({ value: r.value, count: r.count })),
  }
}
