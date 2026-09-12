import { useEffect, useRef, type ReactNode } from 'react'

export interface DrawerProps {
  open: boolean
  label: string
  /** The drawer's tabs, shown in its header. */
  header: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * A panel that slides over the right of the workspace, so occasional tools
 * (Regenerate, History, Debug) never push the drawing out of view. It stays
 * mounted while closed, so a regeneration still running is not lost; closed,
 * it is inert and out of the tab order.
 */
export function Drawer({ open, label, header, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.inert = !open
  }, [open])

  return (
    <aside ref={ref} className={`st-drawer ${open ? 'is-open' : ''}`} aria-label={label} aria-hidden={!open}>
      <div className="st-drawer__head">
        {header}
        <button type="button" className="st-icon-button" aria-label="Close (Esc)" title="Close (Esc)" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="st-drawer__body">{children}</div>
    </aside>
  )
}
