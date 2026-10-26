const transitions = {
  pending: new Set(['approved', 'declined', 'resubmit']),
  resubmit: new Set(['approved', 'declined', 'resubmit']),
  approved: new Set(),
  declined: new Set(['resubmit']),
}

export function assertStatusTransition(from, to) {
  if (!transitions[from]?.has(to)) {
    const error = new Error(`Cannot change submission status from ${from} to ${to}.`)
    error.status = 409
    error.code = 'invalid_status_transition'
    throw error
  }
}

export function reviewAction(status, reason = '', note = '') {
  if (status === 'declined' && !reason.trim()) {
    const error = new Error('A decline reason is required.')
    error.status = 400
    error.code = 'decline_reason_required'
    throw error
  }
  if (status !== 'declined' && (reason || note)) {
    const error = new Error('A decline reason or reviewer note is only valid when declining.')
    error.status = 400
    error.code = 'invalid_review_details'
    throw error
  }
  return { declineReason: status === 'declined' ? reason.trim() : null, reviewerNote: note.trim() || null }
}
