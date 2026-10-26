import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const review = vi.fn()
const refresh = vi.fn()
let apiState
let portalState

vi.mock('../../lib/api', () => ({ API_ENABLED: true }))
vi.mock('../../lib/useEscapeToClose', () => ({
  useEscapeToClose: vi.fn(),
  useScrollLock: vi.fn(),
}))
vi.mock('../../lib/store', () => ({
  usePortal: () => portalState,
}))
vi.mock('../../lib/useSubmissions', () => ({
  useSubmissions: () => apiState,
}))

const { default: SubmissionsView } = await import('./SubmissionsView')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

const apiSubmission = (overrides = {}) => ({
  id: 'api-1',
  type: 'verification',
  status: 'pending',
  staffName: 'Ada Lovelace',
  staffId: 'staff-1',
  staffType: 'Field staff',
  species: 'Narra',
  treeTag: 'TREE-API-1',
  event: 'API Planting',
  lat: '12.3',
  lng: '45.6',
  date: '2026-10-20',
  ...overrides,
})

function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<SubmissionsView />))
}

function text() {
  return container.textContent.replace(/\s+/g, ' ').trim()
}

function button(label) {
  return [...container.querySelectorAll('button')].find(node => node.textContent.replace(/\s+/g, ' ').trim() === label)
}

function click(node) {
  act(() => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

async function settle() {
  await act(async () => {})
}

beforeEach(() => {
  review.mockReset()
  refresh.mockReset()
  apiState = {
    submissions: [apiSubmission()],
    loading: false,
    error: null,
    refresh,
    review,
  }
  portalState = {
    submissions: [{ ...apiSubmission({ id: 'local-1', treeTag: 'TREE-LOCAL-1', staffName: 'Local only' }) }],
    pendingCount: 1,
    incidentCount: 0,
    focus: null,
    clearFocus: vi.fn(),
    storeActions: {
      approveSubmissions: vi.fn(),
      declineSubmissions: vi.fn(),
      requestResubmit: vi.fn(),
    },
  }
})

afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  root = null
  container = null
})

describe('SubmissionsView', () => {
  it('uses API submissions instead of local store rows when API mode is enabled', () => {
    render()
    expect(text()).toContain('TREE-API-1')
    expect(text()).not.toContain('TREE-LOCAL-1')
    expect(text()).toContain('1 pending')
  })

  it('renders API loading, empty, and error states with retry', () => {
    apiState = { ...apiState, loading: true, submissions: [] }
    render()
    expect(text()).toContain('Loading submissions…')

    apiState = { ...apiState, loading: false, error: 'API unavailable' }
    act(() => root.render(<SubmissionsView />))
    expect(text()).toContain('API unavailable')
    expect(text()).toContain('No submissions match your current filters.')

    click(button('Retry'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('reviews a selected pending API submission and refreshes the list', async () => {
    review.mockResolvedValue({ submission_id: 'api-1', status: 'approved' })
    render()

    click(container.querySelector('[aria-label="Select all filtered submissions"]'))
    expect(text()).toContain('Approve Selected (1)')
    click(button('✓ Approve Selected (1)'))
    await settle()

    expect(review).toHaveBeenCalledWith('api-1', { status: 'approved' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('forwards decline reason and note, and reports failed reviews', async () => {
    review.mockRejectedValueOnce(new Error('Review failed'))
    render()

    click(button('View'))
    click(button('Decline'))
    const reason = [...container.querySelectorAll('label')].find(node => node.textContent.includes('Out-of-Bounds GPS'))
    click(reason.querySelector('input'))
    const note = container.querySelector('textarea')
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setValue.call(note, 'Move the marker inside the boundary')
      note.dispatchEvent(new Event('input', { bubbles: true }))
      note.dispatchEvent(new Event('change', { bubbles: true }))
    })
    click(button('Decline 1 Submission'))
    await settle()

    expect(review).toHaveBeenCalledWith('api-1', {
      status: 'declined',
      reason: 'Out-of-Bounds GPS',
      note: 'Move the marker inside the boundary',
    })
    expect(text()).toContain('Review failed')
  })

  it('supports single resubmit and approve actions from the detail drawer', async () => {
    review.mockResolvedValue({ submission_id: 'api-1', status: 'resubmit' })
    render()
    click(button('View'))
    click(button('Request Re-submit'))
    await settle()
    expect(review).toHaveBeenCalledWith('api-1', { status: 'resubmit' })

    review.mockResolvedValue({ submission_id: 'api-1', status: 'approved' })
    // The drawer stays open while the API refreshes; approve remains available.
    click(button('Approve ✓'))
    await settle()
    expect(review).toHaveBeenLastCalledWith('api-1', { status: 'approved' })
  })
})
