import test from 'node:test'
import assert from 'node:assert/strict'
import { assertStatusTransition, reviewAction } from '../src/submission-workflow.js'

test('allows pending submissions to be approved, declined, or sent back', () => {
  assert.doesNotThrow(() => assertStatusTransition('pending', 'approved'))
  assert.doesNotThrow(() => assertStatusTransition('pending', 'declined'))
  assert.doesNotThrow(() => assertStatusTransition('pending', 'resubmit'))
})

test('does not allow an approved submission to be changed', () => {
  assert.throws(
    () => assertStatusTransition('approved', 'declined'),
    error => error.code === 'invalid_status_transition' && error.status === 409,
  )
})

test('requires a reason for declines and keeps review details normalized', () => {
  assert.throws(() => reviewAction('declined'), error => error.code === 'decline_reason_required')
  assert.deepEqual(reviewAction('declined', '  GPS mismatch  ', '  Check the boundary  '), {
    declineReason: 'GPS mismatch',
    reviewerNote: 'Check the boundary',
  })
})

test('does not accept decline-only fields for approval', () => {
  assert.throws(() => reviewAction('approved', 'not applicable'), error => error.code === 'invalid_review_details')
  assert.deepEqual(reviewAction('approved'), { declineReason: null, reviewerNote: null })
})
