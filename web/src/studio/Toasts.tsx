import { useCallback, useRef, useState, type ReactNode } from 'react'

export interface Toast {
  id: number
  message: ReactNode
  tone: 'success' | 'error'
  /** Stays until dismissed, for something to act on (a command to copy). */
  sticky: boolean
}

export type PushToast = (message: ReactNode, tone?: Toast['tone'], options?: { sticky?: boolean }) => void

/**
 * Passing confirmations ("Saved", "Published") that do not push the page
 * down. Successes fade after a few seconds; errors and sticky ones stay.
 */
export function useToasts(): [Toast[], PushToast, (id: number) => void] {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const push = useCallback<PushToast>(
    (message, tone = 'success', { sticky = false } = {}) => {
      nextId.current += 1
      const id = nextId.current
      setToasts((current) => [...current.slice(-2), { id, message, tone, sticky }])
      if (tone === 'success' && !sticky) window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  return [toasts, push, dismiss]
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="st-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`st-toast st-toast--${toast.tone}`}>
          <div className="st-toast__message">{toast.message}</div>
          <button type="button" className="st-toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
