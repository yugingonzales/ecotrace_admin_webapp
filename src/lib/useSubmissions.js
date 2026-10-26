import { useEffect, useState } from 'react'
import { API_ENABLED, listSubmissions, reviewSubmission } from './api'

/** @typedef {import('./store.js').Submission} Submission */
/** @typedef {{ status: 'approved' | 'declined' | 'resubmit', reason?: string, note?: string }} ReviewInput */

/** @param {string | null | undefined} value */
function displayDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** @param {Record<string, unknown>} row @returns {Submission} */
export function submissionFromApi(row) {
  const type = row.submission_type === 'incident' ? 'incident' : 'verification'
  const status = ['pending', 'approved', 'declined', 'resubmit'].includes(String(row.submission_status))
    ? row.submission_status
    : 'pending'
  const first = String(row.submitter_first_name ?? '').trim()
  const last = String(row.submitter_last_name ?? '').trim()
  return {
    id: String(row.submission_id ?? ''),
    type,
    status,
    staffName: `${first} ${last}`.trim() || 'Unknown submitter',
    staffId: row.submitted_by == null ? '—' : String(row.submitted_by),
    staffType: 'Staff',
    species: String(row.tree_name ?? 'Unknown species'),
    treeTag: String(row.tree_code ?? '—'),
    event: String(row.event_title ?? 'Unassigned event'),
    lat: row.latitude == null ? '—' : String(row.latitude),
    lng: row.longitude == null ? '—' : String(row.longitude),
    date: displayDate(row.submitted_at == null ? null : String(row.submitted_at)),
    incidentType: type === 'incident' ? 'Incident' : undefined,
    declineReason: row.decline_reason == null ? undefined : String(row.decline_reason),
    notes: row.reviewer_note == null ? undefined : String(row.reviewer_note),
  }
}

/**
 * @returns {{ submissions: Submission[], loading: boolean, error: string | null, refresh: () => void, review: (id: string, input: ReviewInput) => Promise<unknown> }}
 */
export function useSubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(API_ENABLED)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!API_ENABLED) {
      setSubmissions([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    listSubmissions({ page: 1, pageSize: 200 })
      .then(page => {
        if (cancelled) return
        const rows = Array.isArray(page?.items) ? page.items.map(submissionFromApi) : []
        setSubmissions(rows)
        setError(null)
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load submissions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  async function review(id, input) {
    if (!API_ENABLED) throw new Error('Submission API is disabled')
    return reviewSubmission(id, input)
  }

  return { submissions, loading, error, refresh: () => setAttempt(value => value + 1), review }
}
