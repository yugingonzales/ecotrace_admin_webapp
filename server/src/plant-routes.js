import { Router } from "express"
import { z } from "zod"
import { pool } from "./db.js"

const router = Router()
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(100),
})

router.get("/", async (req, res, next) => {
  try {
    const { page, pageSize } = querySchema.parse(req.query)
    const offset = (page - 1) * pageSize
    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS total FROM ecotrace_plants WHERE tree_code IS NOT NULL",
    )
    const [items] = await pool.query(
      `SELECT tree_id, tree_code, zone_name, latitude, longitude,
              tree_planter_name, tree_name, tree_planted_date, tree_status
         FROM ecotrace_plants
        WHERE tree_code IS NOT NULL
        ORDER BY tree_id ASC
        LIMIT ? OFFSET ?`,
      [pageSize, offset],
    )
    res.json({
      items,
      total: Number(count.total),
      page,
      pageSize,
    })
  } catch (error) {
    next(error)
  }
})

export default router
