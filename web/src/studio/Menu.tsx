import { useEffect, useRef, useState } from 'react'

export type MenuEntry =
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | 'separator'

/**
 * A "⋯" button that opens a short list of actions, so rows and headers carry
 * one control instead of a cluster. Closes on a click outside or on Escape.
 */
export function Menu({ label, entries }: { label: string; entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="st-menu" ref={root}>
      <button
        type="button"
        className="st-icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open ? (
        <ul className="st-menu__list" role="menu">
          {entries.map((entry, index) =>
            entry === 'separator' ? (
              <li key={`separator-${index}`} role="separator" className="st-menu__separator" />
            ) : (
              <li key={entry.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`st-menu__item ${entry.danger ? 'is-danger' : ''}`}
                  disabled={entry.disabled}
                  onClick={() => {
                    setOpen(false)
                    entry.onSelect()
                  }}
                >
                  {entry.label}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  )
}
