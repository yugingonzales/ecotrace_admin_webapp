/**
 * EcoTrace authentication API.
 *
 * Domain data is intentionally deferred. The server currently exposes the
 * health probe and login-related routes only; plant, tree, event, and
 * verification data remains hardcoded in the clients for later development.
 */

import express from "express"

import cors from "cors"
import { z } from "zod"

import { fileURLToPath } from "node:url"

import { ping, closePool } from "./db.js"

import authRoutes from "./auth-routes.js"

import eventRoutes from "./events-routes.js"
import alertRoutes from "./alerts-routes.js"
import plantRoutes from "./plant-routes.js"
import submissionRoutes from "./submissions-routes.js"

const app = express()

// API_PORT, not PORT. The Vite dev server used to read PORT as well, so

// `PORT=3000 npm run dev` in the API shell made Vite try to bind 3000 too and

// abort with strictPort. Each process now owns a variable. PORT is still

// honoured as a fallback so an existing shell export does not silently change

// which port the API binds.

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3000)

const HOST = process.env.API_HOST ?? "0.0.0.0"

app.disable("x-powered-by")

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }))

app.use(express.json({ limit: "1mb" }))

app.use("/api/auth", authRoutes)

// Active events are public for the mobile schedule; mutations remain admin-only.

app.use("/api/events", eventRoutes)
app.use("/api/alerts", alertRoutes)
app.use("/api/plants", plantRoutes)
app.use("/api/submissions", submissionRoutes)

// ── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  const db = await ping()

  // 200 when the process is up even if the DB is down: the liveness signal and

  // the readiness signal are different questions, and conflating them makes

  // orchestrator restarts fire on every transient database blip.

  res.status(200).json({
    status: "ok",

    service: "ecotrace-api",

    database: db,

    timestamp: new Date().toISOString(),
  })
})

app.use((_req, res) => {
  res.status(404).json({ error: "not_found", message: "No such route." })
})

// Central error handler. Logs server-side, returns a generic message to the

// client - SQL text and connection details do not belong in an HTTP response.

//

// The status is carried through instead of being hardcoded to 500. Express and

// body-parser tag the client's own mistakes (malformed JSON, oversized body)

// with a 4xx `status`/`statusCode`; reporting those as 500 told a caller the

// server was broken, and the real cause only ever appeared in this log.

app.use((error, _req, res, _next) => {
  const status = error instanceof z.ZodError
    ? 400
    : Number(error?.status ?? error?.statusCode ?? 500) || 500

  const serverFault = status >= 500

  if (serverFault) console.error("[ecotrace-api] unhandled error:", error)

  res.status(status).json({
    error: serverFault ? "internal_error" : "invalid_request",

    message: serverFault
      ? "Unexpected server error."
      : "The request body could not be read.",
  })
})

let server

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server = app.listen(PORT, HOST, () => {
    console.log(`[ecotrace-api] listening on http://${HOST}:${PORT}`)

    console.log(
      `[ecotrace-api] LAN clients can use http://<PC_LAN_IP>:${PORT}/api`,
    )
  })

  // Close the pool on shutdown so in-flight requests drain instead of the

  // process dropping sockets out from under them.

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await closePool()

        process.exit(0)
      })
    })
  }
}

export { app, server }
