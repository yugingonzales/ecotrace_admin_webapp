import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { z } from 'zod'
import { createServer } from 'node:http'
import { createSubmissionsRouter } from '../src/submissions-routes.js'

function middlewareFor(user) {
  return (req, res, next) => {
    if (req.get('authorization') !== 'Bearer test-token') return res.status(401).json({ error: 'unauthorized' })
    req.user = user
    next()
  }
}

function rolesMiddleware(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role_name)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

function fakeDatabase({ submission = { submission_id: 7, tree_id: 12, submission_status: 'pending' }, failQuery = false } = {}) {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push({ method: 'beginTransaction' }) },
    async query(sql, params) {
      calls.push({ method: 'query', sql, params })
      if (failQuery && sql.startsWith('UPDATE ecotrace_submissions')) throw new Error('write failed')
      if (sql.startsWith('SELECT submission_id')) return [[submission ?? undefined]]
      return [[], {}]
    },
    async commit() { calls.push({ method: 'commit' }) },
    async rollback() { calls.push({ method: 'rollback' }) },
    release() { calls.push({ method: 'release' }) },
  }
  return {
    calls,
    async query(sql, params) {
      calls.push({ method: 'pool.query', sql, params })
      if (sql.startsWith('SELECT COUNT')) return [[{ total: 9 }]]
      return [[{ submission_id: 7, submission_status: 'pending' }]]
    },
    async getConnection() { calls.push({ method: 'getConnection' }); return connection },
  }
}

async function withApp({ user = { id: 3, role_name: 'admin' }, database, token = 'test-token' } = {}, run) {
  const app = express()
  app.use(express.json())
  app.use('/api/submissions', createSubmissionsRouter({
    submissionPool: database,
    authenticateMiddleware: middlewareFor(user),
    requireRolesMiddleware: rolesMiddleware,
  }))
  app.use((error, _req, res, _next) => {
    const status = error instanceof z.ZodError ? 400 : (error.status ?? 500)
    res.status(status).json({ error: error.code ?? (status === 400 ? 'invalid_request' : 'internal_error'), message: error.message })
  })
  const server = createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    const request = async (path, options = {}) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        ...options,
        headers: { connection: 'close', authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers ?? {}) },
      })
      return { status: response.status, body: await response.json() }
    }
    return await run(request)
  } finally { await new Promise(resolve => server.close(resolve)) }
}

test('requires authentication and allows only staff or admin roles', async () => {
  const database = fakeDatabase()
  await withApp({ database, token: 'missing' }, async request => assert.equal((await request('/api/submissions')).status, 401))
  await withApp({ database, user: { id: 3, role_name: 'volunteer' } }, async request => assert.equal((await request('/api/submissions')).status, 403))
})

test('lists submissions with status filtering and bounded pagination', async () => {
  const database = fakeDatabase()
  await withApp({ database }, async request => {
    const response = await request('/api/submissions?status=pending&page=2&pageSize=10')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { items: [{ submission_id: 7, submission_status: 'pending' }], total: 9, page: 2, pageSize: 10 })
    const listCall = database.calls.find(call => call.method === 'pool.query' && call.sql.startsWith('SELECT COUNT'))
    assert.deepEqual(listCall.params, ['pending'])
  })
  await withApp({ database }, async request => assert.equal((await request('/api/submissions?pageSize=201')).status, 400))
})

test('approves a pending submission, verifies its plant, audits, and commits', async () => {
  const database = fakeDatabase()
  await withApp({ database }, async request => {
    const response = await request('/api/submissions/7/review', { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) })
    assert.deepEqual(response, { status: 200, body: { submission_id: 7, status: 'approved' } })
  })
  const sql = database.calls.filter(call => call.method === 'query').map(call => call.sql)
  assert.ok(sql.some(value => value.includes('UPDATE ecotrace_plants')))
  assert.ok(sql.some(value => value.includes('INSERT INTO ecotrace_audit_logs')))
  assert.equal(database.calls.filter(call => call.method === 'commit').length, 1)
  assert.equal(database.calls.filter(call => call.method === 'rollback').length, 0)
})

test('validates decline details, handles not-found and invalid transitions with rollback', async () => {
  const database = fakeDatabase({ submission: null })
  await withApp({ database }, async request => {
    const missing = await request('/api/submissions/7/review', { method: 'PATCH', body: JSON.stringify({ status: 'declined', reason: 'GPS mismatch' }) })
    assert.equal(missing.status, 404)
  })
  assert.equal(database.calls.filter(call => call.method === 'rollback').length, 1)

  const approved = fakeDatabase({ submission: { submission_id: 7, tree_id: 12, submission_status: 'approved' } })
  await withApp({ database: approved }, async request => {
    const invalid = await request('/api/submissions/7/review', { method: 'PATCH', body: JSON.stringify({ status: 'declined', reason: 'Duplicate' }) })
    assert.equal(invalid.status, 409)
  })
  assert.equal(approved.calls.filter(call => call.method === 'rollback').length, 1)

  const validation = fakeDatabase()
  await withApp({ database: validation }, async request => {
    const invalid = await request('/api/submissions/7/review', { method: 'PATCH', body: JSON.stringify({ status: 'declined' }) })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.error, 'decline_reason_required')
  })
  assert.equal(validation.calls.filter(call => call.method === 'getConnection').length, 0)
})

test('rolls back and releases the connection when a write fails', async () => {
  const database = fakeDatabase({ failQuery: true })
  await withApp({ database }, async request => {
    const response = await request('/api/submissions/7/review', { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) })
    assert.equal(response.status, 500)
  })
  assert.equal(database.calls.filter(call => call.method === 'rollback').length, 1)
  assert.equal(database.calls.filter(call => call.method === 'release').length, 1)
})
