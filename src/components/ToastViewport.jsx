import { useEffect, useRef } from 'react'
import { usePortal } from '../lib/store'

const TOAST_MS = 3200

/**
 * Renders the store's transient toasts.
 *
 * The dismiss timer is cleared on unmount — the old inline `setTimeout` in
 * SubmissionsView fired `setToast(null)` on a component that was already gone,
 * which is exactly the class of leak that turns a fast tab switch into a React
 * warning.
 */
export default function ToastViewport() {
  const { toasts, storeActions } = usePortal()
  /** @type {import('react').RefObject<Map<number, ReturnType<typeof setTimeout>>>} */
  const timers = useRef(new Map())

  useEffect(() => {
    for (const t of toasts) {
      if (timers.current.has(t.id)) continue
      const timer = setTimeout(() => {
        timers.current.delete(t.id)
        storeActions.dismissToast(t.id)
      }, TOAST_MS)
      timers.current.set(t.id, timer)
    }
    // Drop timers for toasts that were dismissed by hand before firing.
    for (const [id, timer] of timers.current) {
      if (!toasts.some(t => t.id === id)) {
        clearTimeout(timer)
        timers.current.delete(id)
      }
    }
  }, [toasts, storeActions])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2 px-3.5 py-2.5 rounded-lg text-xs shadow-lg"
          style={{
            background: '#fff',
            border: `1px solid ${t.type === 'error' ? 'rgba(220,58,58,0.35)' : 'rgba(47,158,110,0.35)'}`,
            color: 'var(--text)',
            maxWidth: 360,
            boxShadow: '0 8px 24px rgba(16,24,40,0.14)',
          }}
        >
          <span className="badge" style={{ background: t.type === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)', color: t.type === 'error' ? 'var(--danger)' : 'var(--accent-dark)' }}>
            {t.type === 'error' ? '!' : '✓'}
          </span>
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button
            onClick={() => storeActions.dismissToast(t.id)}
            className="text-[13px] leading-none"
            style={{ color: 'var(--text-faint)' }}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
