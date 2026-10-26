import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listSubmissions = vi.fn()
const reviewSubmission = vi.fn()

vi.mock('./api', () => ({
  API_ENABLED: true,
  listSubmissions,
  reviewSubmission,
}))

const { submissionFromApi, useSubmissions } = await import('./useSubmissions')

var IS_REACT_ACT_ENVIRONMENT = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root
let result

function Probe() {
  result = useSubmissions()
  return (
    <div>
      <span data-testid="loading">{String(result.loading)}</span>
      <span data-testid="count">{result.submissions.length}</span>
      <span data-testid="error">{result.error ?? ''}</span>
    </div>
  )
}

function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Probe />))
}

function text(testid) {
  return container.querySelector(`[data-testid="${testid}"]`)?.textContent
}

async function settle() {
  await act(async () => {})
}

beforeEach(() => {
  listSubmissions.mockReset()
  reviewSubmission.mockReset()
  result = null
})

afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  root = null
  container = null
})

describe('submissionFromApi', () => {
  it('maps verification rows and normalizes display fallbacks', () => {
    expect(submissionFromApi({
      submission_id: 42,
      submission_type: 'verification',
      submission_status: 'pending',
      submitted_by: 7,
      submitter_first_name: ' Ada ',
      submitter_last_name: ' Lovelace ',
      tree_name: 'Narra',
      tree_code: 'TRE-042',
      event_title: 'Campus Planting',
      latitude: 12.34,
      longitude: 56.78,
      submitted_at: '2026-10-20T00:00:00Z',
      decline_reason: null,
      reviewer_note: null,
    })).toMatchObject({
      id: '42',
      type: 'verification',
      status: 'pending',
      staffName: 'Ada Lovelace',
      staffId: '7',
      species: 'Narra',
      treeTag: 'TRE-042',
      event: 'Campus Planting',
      lat: '12.34',
      lng: '56.78',
      declineReason: undefined,
      notes: undefined,
    })
  })

  it('maps incidents and protects against missing or unknown values', () => {
    expect(submissionFromApi({
      submission_id: 9,
      submission_type: 'incident',
      submission_status: 'unexpected',
      submitted_by: null,
      submitter_first_name: '',
      submitter_last_name: '',
      submitted_at: null,
      decline_reason: 'GPS mismatch',
      reviewer_note: 'Check boundary',
    })).toMatchObject({
      id: '9',
      type: 'incident',
      status: 'pending',
      staffName: 'Unknown submitter',
      staffId: '—',
      species: 'Unknown species',
      treeTag: '—',
      event: 'Unassigned event',
      lat: '—',
      lng: '—',
      date: '—',
      incidentType: 'Incident',
      declineReason: 'GPS mismatch',
      notes: 'Check boundary',
    })
  })
})

describe('useSubmissions', () => {
  it('loads and maps API rows with the expected request', async () => {
    listSubmissions.mockResolvedValue({ items: [{ submission_id: 1, submission_type: 'verification', submission_status: 'pending' }] })
    render()
    expect(text('loading')).toBe('true')
    await settle()
    expect(listSubmissions).toHaveBeenCalledWith({ page: 1, pageSize: 200 })
    expect(result.submissions).toHaveLength(1)
    expect(text('loading')).toBe('false')
    expect(text('error')).toBe('')
  })

  it('treats an empty or malformed items response as an empty success', async () => {
    listSubmissions.mockResolvedValue({ items: [] })
    render()
    await settle()
    expect(result.submissions).toEqual([])
    expect(result.error).toBeNull()

    listSubmissions.mockResolvedValue({})
    act(() => result.refresh())
    await settle()
    expect(result.submissions).toEqual([])
    expect(result.error).toBeNull()
  })

  it('surfaces load errors and retries successfully', async () => {
    listSubmissions.mockRejectedValueOnce(new Error('API unavailable'))
      .mockResolvedValueOnce({ items: [{ submission_id: 2 }] })
    render()
    await settle()
    expect(result.error).toBe('API unavailable')
    expect(result.submissions).toEqual([])

    act(() => result.refresh())
    await settle()
    expect(listSubmissions).toHaveBeenCalledTimes(2)
    expect(result.error).toBeNull()
    expect(result.submissions[0].id).toBe('2')
  })

  it('forwards review payloads and propagates failed reviews', async () => {
    listSubmissions.mockResolvedValue({ items: [] })
    reviewSubmission.mockResolvedValue({ submission_id: 3, status: 'approved' })
    render()
    await settle()
    await expect(result.review('3', { status: 'approved' })).resolves.toEqual({ submission_id: 3, status: 'approved' })
    expect(reviewSubmission).toHaveBeenCalledWith('3', { status: 'approved' })

    reviewSubmission.mockRejectedValueOnce(new Error('Review failed'))
    await expect(result.review('3', { status: 'declined', reason: 'Blurry' })).rejects.toThrow('Review failed')
  })
})
