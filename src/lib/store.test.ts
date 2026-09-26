import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDraft } from './store'

/**
 * Store tests.
 *
 * The store is a module singleton, so every test gets a fresh one by clearing
 * storage and re-importing the module. That also exercises `hydrate()`, which is
 * the real cold-start path a user hits on a page refresh.
 */
async function freshStore() {
  localStorage.clear()
  vi.resetModules()
  return import('./store')
}

const STORAGE_KEY = 'ecotrace_store_v1'

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  title: 'Mangrove Recovery Drive',
  description: '',
  plantFrom: '',
  plantTo: '',
  quota: '10',
  start: '2026-06-01',
  end: '2026-06-30',
  zone: 'Zone A – Main Campus',
  boundary: [],
  guidelines: '',
  metrics: ['GPS Coordinates'],
  ...over,
})

describe('date helpers', () => {
  it('round-trips a MariaDB timestamp through the log date filter', async () => {
    const { formatStamp, stampDate } = await freshStore()
    const stamp = formatStamp(new Date(2026, 3, 28, 10, 42, 31))
    expect(stamp).toBe('2026-04-28 10:42:31')
    expect(stampDate(stamp)).toBe('2026-04-28')
  })

  it('returns an empty date for an unparseable stamp instead of "Invalid Date"', async () => {
    const { stampDate } = await freshStore()
    expect(stampDate('not-a-date')).toBe('')
    expect(stampDate('')).toBe('')
  })

  it('converts between the display and ISO date forms an event carries', async () => {
    const { parseDisplayDate, formatDisplayDate, isoToDisplay } = await freshStore()
    expect(isoToDisplay('2026-05-15')).toBe('May 15, 2026')
    const d = parseDisplayDate('May 15, 2026')
    expect(d).not.toBeNull()
    expect(formatDisplayDate(d!)).toBe('May 15, 2026')
  })

  it('refuses to parse a malformed display date rather than returning an Invalid Date', async () => {
    const { parseDisplayDate } = await freshStore()
    expect(parseDisplayDate('15/05/2026')).toBeNull()
    expect(parseDisplayDate('Foo 15, 2026')).toBeNull()
  })
})

describe('submission reducers', () => {
  it('approves only pending rows and reports an accurate count', async () => {
    const { actions, getSnapshot } = await freshStore()
    const result = actions.approveSubmissions(['SUB-4421', 'SUB-4418', 'SUB-4417'])
    // SUB-4418 is already approved and SUB-4417 already declined, so only one row moves.
    expect(result.changed).toBe(1)

    const submissions = getSnapshot().submissions
    expect(submissions.find(s => s.id === 'SUB-4421')?.status).toBe('approved')
    expect(submissions.find(s => s.id === 'SUB-4418')?.status).toBe('approved')
    expect(submissions.find(s => s.id === 'SUB-4417')?.status).toBe('declined')
  })

  it('is idempotent: a second approve of the same id changes nothing and warns', async () => {
    const { actions, getSnapshot } = await freshStore()
    expect(actions.approveSubmissions(['SUB-4421']).changed).toBe(1)
    const second = actions.approveSubmissions(['SUB-4421'])
    expect(second.changed).toBe(0)
    const snap = getSnapshot()
    expect(snap.toasts.at(-1)?.type).toBe('error')
    // No second audit row: the count always equals rows that actually changed.
    // (`seeded` excludes the bundled LOG-1044 fixture row.)
    expect(snap.logs.filter(l => l.action === 'BATCH_APPROVE' && !l.seeded)).toHaveLength(1)
  })

  it('declines with the reason and note, and marks re-submit separately', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.declineSubmissions(['SUB-4420'], 'Out-of-Bounds GPS', 'Outside the campus fence')
    actions.requestResubmit(['SUB-4419'])

    const { submissions, logs } = getSnapshot()
    const declined = submissions.find(s => s.id === 'SUB-4420')
    expect(declined?.status).toBe('declined')
    expect(declined?.declineReason).toBe('Out-of-Bounds GPS')
    expect(declined?.notes).toContain('Outside the campus fence')

    expect(submissions.find(s => s.id === 'SUB-4419')?.status).toBe('resubmit')
    expect(logs[0].action).toBe('BATCH_RESUBMIT')
    expect(logs[1].action).toBe('BATCH_DECLINE')
  })

  it('emits a toast, a notification and an audit row from one commit', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.approveSubmissions(['SUB-4421', 'SUB-4419'])
    const { toasts, notifications, logs } = getSnapshot()
    expect(toasts).toHaveLength(1)
    expect(notifications.filter(n => !n.read)).toHaveLength(1)
    expect(logs[0].count).toBe(2)
    expect(logs[0].detail).toContain('SUB-4421')
    expect(logs[0].detail).toContain('SUB-4419')
  })

  it('never reuses a log id, which is what a module-level counter did on HMR', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.approveSubmissions(['SUB-4421'])
    actions.approveSubmissions(['SUB-4419'])
    actions.requestResubmit(['SUB-4420'])
    const ids = getSnapshot().logs.map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    // The fixture ends at LOG-1044, so three actions are 1045, 1046 and 1047.
    expect(getSnapshot().logs[0].id).toBe('LOG-1047')
    expect(ids[2]).toBe('LOG-1045')
  })
})

describe('event reducers', () => {
  it('creates a published event with no staff and no target, not a fake 0%', async () => {
    const { actions, eventProgress, getSnapshot } = await freshStore()
    const created = actions.createEvent(draft(), true)
    expect(created.id).toBe('E005')
    expect(created.status).toBe('active')
    expect(created.staff).toBe(0)
    expect(created.target).toBe(0)
    expect(eventProgress(created)).toBeNull()
    expect(created.start).toBe('Jun 1, 2026')
    expect(created.end).toBe('Jun 30, 2026')
    // June starts a new school year.
    expect(created.year).toBe('2026–2027')
    expect(getSnapshot().logs[0].action).toBe('EVENT_PUBLISH')
  })

  it('saves a draft without marking it active', async () => {
    const { actions, getSnapshot } = await freshStore()
    const created = actions.createEvent(draft(), false)
    expect(created.status).toBe('draft')
    expect(created.id).toBe('E005')
    expect(getSnapshot().logs[0].action).toBe('EVENT_CREATE')
  })

  it('clamps the quota to 1..50 instead of trusting the field', async () => {
    const { actions } = await freshStore()
    expect(actions.createEvent(draft({ quota: '9999' }), true).quota).toBe(50)
    expect(actions.createEvent(draft({ quota: '0' }), true).quota).toBe(1)
    expect(actions.createEvent(draft({ quota: 'abc' }), true).quota).toBe(1)
  })

  it('extends the end date with real date arithmetic across a month boundary', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.extendEvent('E001', 7) // May 15 -> May 22
    actions.extendEvent('E002', 7) // Apr 30 -> May 7
    const byId = Object.fromEntries(getSnapshot().events.map(e => [e.id, e]))
    expect(byId.E001.end).toBe('May 22, 2026')
    expect(byId.E001.endIso).toBe('2026-05-22')
    expect(byId.E002.end).toBe('May 7, 2026')
    expect(getSnapshot().logs[0].action).toBe('EVENT_EXTEND')
  })

  it('recomputes the target from the new quota and staff count', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.reassignQuotas('E001', 4) // was 50 x 45 = 2250
    const ev = getSnapshot().events.find(e => e.id === 'E001')!
    expect(ev.quota).toBe(4)
    expect(ev.target).toBe(4 * 45)
  })

  it('reassigns a quota on a new event with no staff without producing a target', async () => {
    const { actions, getSnapshot } = await freshStore()
    const created = actions.createEvent(draft(), true)
    actions.reassignQuotas(created.id, 12)
    const ev = getSnapshot().events.find(e => e.id === created.id)!
    expect(ev.quota).toBe(12)
    expect(ev.target).toBe(0) // 12 x 0 staff, not a made-up number
  })

  it('errors instead of throwing when the event id is unknown', async () => {
    const { actions, getSnapshot } = await freshStore()
    expect(actions.extendEvent('E999').changed).toBe(0)
    expect(actions.reassignQuotas('E999', 5).changed).toBe(0)
    expect(getSnapshot().toasts.every(t => t.type === 'error')).toBe(true)
  })
})


describe('persistence', () => {
  it('writes the change and survives a reload', async () => {
    const { actions } = await freshStore()
    actions.approveSubmissions(['SUB-4421'])

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(raw).toContain('SUB-4421')

    // Re-import without clearing storage: this is exactly what a refresh does.
    vi.resetModules()
    const reloaded = await import('./store')
    expect(
      reloaded.getSnapshot().submissions.find(s => s.id === 'SUB-4421')?.status,
    ).toBe('approved')
    expect(reloaded.getSnapshot().logs[0].action).toBe('BATCH_APPROVE')
  })

  it('never persists toasts or the signed-in actor', async () => {
    const { actions } = await freshStore()
    actions.setActor({ name: 'Admin Jane', email: 'jane@uep.edu.ph' })
    actions.approveSubmissions(['SUB-4421'])

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.toasts).toBeUndefined()
    expect(saved.actor).toBeUndefined()
    // ...but the actor is still used for audit attribution right now.
    expect(saved.logs[0].admin).toBe('Admin Jane')
  })

  it('re-appends a fixture row that a stale saved list is missing', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      submissions: [
        { id: 'SUB-4421', staffName: 'Edited', staffId: 'STF-001', staffType: 'Volunteer', treeTag: 'TRE-0892', species: 'Narra', type: 'verification', status: 'approved', event: 'Arbor Day Drive 2026', date: 'Apr 28, 2026 09:14', lat: '12.5101', lng: '124.6679', photo: '' },
      ],
    }))
    vi.resetModules()
    const { getSnapshot } = await import('./store')
    const subs = getSnapshot().submissions
    // The live row wins and keeps its edit...
    expect(subs.find(s => s.id === 'SUB-4421')?.staffName).toBe('Edited')
    // ...and the fixtures the saved list never saw are appended, not shadowed.
    expect(subs.find(s => s.id === 'SUB-4414')).toBeDefined()
    expect(subs[0].id).toBe('SUB-4421')
  })

  it('treats corrupted storage as a clean miss instead of crashing', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json')
    vi.resetModules()
    const { getSnapshot } = await import('./store')
    expect(getSnapshot().submissions).toHaveLength(8)
  })

  it('pages older audit history and records how much has been loaded', async () => {
    const { actions, getSnapshot } = await freshStore()
    expect(getSnapshot().logs).toHaveLength(12)
    expect(actions.loadOlderLogs()).toBe(6)
    expect(actions.loadOlderLogs()).toBe(4)
    expect(actions.loadOlderLogs()).toBe(0) // exhausted
    expect(actions.olderPagesLoaded).toBe(actions.olderPagesAvailable)
    const ids = getSnapshot().logs.map(l => l.id)
    expect(ids[0]).toBe('LOG-1044')
    expect(ids.at(-1)).toBe('LOG-1023')
  })
})

describe('notification targets', () => {
  it('gives every notification the portal creates a destination', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.approveSubmissions(['SUB-4421'])
    actions.declineSubmissions(['SUB-4420'], 'Location Mismatch', 'GPS out of bounds')
    actions.requestResubmit(['SUB-4419'])
    actions.createEvent(draft(), true)
    actions.extendEvent('E001', 7)
    actions.reassignQuotas('E001', 20)
    actions.recordExport('Exported the submissions register (CSV) — 8 records', 8)

    // The invariant rather than a spot check: an un-aimed row renders as inert
    // text that looks clickable, which is worse than no link at all.
    const rows = getSnapshot().notifications
    expect(rows.filter(n => !n.target)).toEqual([])
  })

  it('sends a single-row decision straight to that row', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.approveSubmissions(['SUB-4421'])
    expect(getSnapshot().notifications.at(-1)?.target).toEqual({
      module: 'submissions',
      treeTag: 'TRE-0892',
    })
  })

  it('sends a batch decision to their event, but only when they shared one', async () => {
    const shared = await freshStore()
    shared.actions.approveSubmissions(['SUB-4421', 'SUB-4420']) // both Arbor Day Drive 2026
    expect(shared.getSnapshot().notifications.at(-1)?.target).toEqual({
      module: 'submissions',
      event: 'Arbor Day Drive 2026',
    })

    const mixed = await freshStore()
    // SUB-4415 belongs to a different event. Narrowing to either one would hide
    // rows the admin just acted on, so the filter is left off entirely.
    // `toEqual` treats an explicit `undefined` as an absent key, which is exactly
    // the "no narrowing" behaviour being asserted here.
    mixed.actions.approveSubmissions(['SUB-4421', 'SUB-4415'])
    expect(mixed.getSnapshot().notifications.at(-1)?.target).toEqual({
      module: 'submissions',
    })
  })

  it('sends event edits to Event Management and the reset notice to Overview', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.createEvent(draft(), false)
    actions.extendEvent('E001', 7)
    expect(getSnapshot().notifications.slice(-2).map(n => n.target)).toEqual([
      { module: 'events' },
      { module: 'events' },
    ])

    actions.resetDemoData()
    // resetDemoData rebuilds from the fixtures, so this also proves the reset
    // notice itself is aimed rather than orphaned.
    const after = getSnapshot().notifications
    expect(after.every(n => n.target)).toBe(true)
    expect(after.at(-1)?.target).toEqual({ module: 'overview' })
  })

  it('backfills a row written before notifications were clickable', async () => {
    // The cold-start path for anyone who used the portal before this shipped.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      notifications: [{ id: 99, msg: 'Legacy row from an older build', type: 'info', time: 1, read: false }],
    }))
    vi.resetModules()
    const { getSnapshot, LEGACY_NOTIFICATION_TARGET } = await import('./store')
    const legacy = getSnapshot().notifications.find(n => n.id === 99)
    expect(legacy?.target).toEqual(LEGACY_NOTIFICATION_TARGET)
    // A malformed target must not be trusted either.
    expect(getSnapshot().notifications.every(n => !!n.target)).toBe(true)
  })

  it('keeps a target across a reload', async () => {
    const first = await freshStore()
    first.actions.approveSubmissions(['SUB-4421'])
    vi.resetModules()
    const reloaded = await import('./store')
    expect(reloaded.getSnapshot().notifications.at(-1)?.target).toEqual({
      module: 'submissions',
      treeTag: 'TRE-0892',
    })
  })
})

describe('attention items', () => {
  it('reports the queued work in the fixtures', async () => {
    const { attentionItems, getSnapshot } = await freshStore()
    const { submissions, events } = getSnapshot()
    const items = attentionItems(submissions, events)
    expect(items.map(i => i.key)).toEqual(['pending', 'incidents', 'backlog'])
    // 6 pending, 3 incidents on file, and 38 + 6 + 3 unverified across 3 events.
    expect(items[0].msg).toContain('6 submissions awaiting review')
    expect(items[1].msg).toContain('3 incident reports on file')
    expect(items[2].msg).toContain('47 unverified submissions')
    // Every item is a link, and the filter matches what it announces.
    expect(items[0].target).toEqual({ module: 'submissions', status: 'pending' })
    expect(items[1].target).toEqual({ module: 'submissions', type: 'incident' })
    expect(items[2].target).toEqual({ module: 'events' })
  })

  it('shrinks as the queue is worked down, and never goes stale', async () => {
    const { actions, attentionItems, getSnapshot } = await freshStore()
    const pendingIds = getSnapshot().submissions.filter(s => s.status === 'pending').map(s => s.id)
    expect(pendingIds).toHaveLength(6)

    actions.approveSubmissions(pendingIds.slice(0, 5))
    let items = attentionItems(getSnapshot().submissions, getSnapshot().events)
    expect(items[0].msg).toContain('1 submission awaiting review')

    actions.approveSubmissions(pendingIds.slice(5))
    items = attentionItems(getSnapshot().submissions, getSnapshot().events)
    // The item is gone because the work is — no expiry rule involved.
    expect(items.map(i => i.key)).not.toContain('pending')
  })

  it('lists nothing when there is nothing queued', async () => {
    const { attentionItems, getSnapshot } = await freshStore()
    expect(attentionItems([], [])).toEqual([])
  })
})

describe('derived selectors', () => {
  it('returns null progress for an event with no target', async () => {
    const { eventProgress } = await freshStore()
    expect(eventProgress({ target: 0, verified: 0 } as never)).toBeNull()
    expect(eventProgress({ target: 100, verified: 25 } as never)).toBe(25)
  })

  it('activeEvents excludes drafts and completed runs', async () => {
    const { actions, activeEvents, getSnapshot } = await freshStore()
    actions.createEvent(draft({ title: 'Draft Run' }), false)
    const running = activeEvents(getSnapshot().events)
    expect(running.map(e => e.name)).toContain('Arbor Day Drive 2026')
    expect(running.map(e => e.name)).not.toContain('Greening Initiative S1')
    expect(running.map(e => e.name)).not.toContain('Draft Run')
  })

  it('resets every counter when the demo data is reset', async () => {
    const { actions, getSnapshot } = await freshStore()
    actions.approveSubmissions(['SUB-4421'])
    actions.createEvent(draft(), true)
    actions.resetDemoData()
    const snap = getSnapshot()
    expect(snap.submissions.find(s => s.id === 'SUB-4421')?.status).toBe('pending')
    expect(snap.events).toHaveLength(4)
    expect(snap.logs).toHaveLength(12)
  })
})

