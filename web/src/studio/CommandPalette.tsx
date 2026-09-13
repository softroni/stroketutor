import { useEffect, useMemo, useRef, useState } from 'react'

import { readyCount } from '../catalog/publishing'

import type { Library } from './library'
import { routeHref } from './route'

interface Command {
  id: string
  kind: 'Page' | 'Path' | 'Lesson'
  label: string
  detail?: string
  href: string
}

/**
 * ⌘K from anywhere: type a few letters of a lesson, a path or a page and
 * press Enter, instead of clicking through the Paths view.
 */
export function CommandPalette({ library, onClose }: { library: Library; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    input.current?.focus()
    return () => dialog?.close()
  }, [])

  const commands = useMemo<Command[]>(() => {
    const catalog = library.catalog
    const pathOf = new Map<string, string>()
    for (const path of catalog?.paths ?? []) for (const id of path.lessonIds) pathOf.set(id, path.title)
    const ready = readyCount(library.publishing.pending)

    const pages: Command[] = [
      { id: 'page:new', kind: 'Page', label: 'New lesson', href: routeHref({ name: 'new', pathId: null }) },
      ...(library.writable
        ? [
            {
              id: 'page:publish',
              kind: 'Page' as const,
              label: 'Publish',
              detail: ready > 0 ? `${ready} ready` : 'nothing ready',
              href: routeHref({ name: 'publish' }),
            },
            { id: 'page:trash', kind: 'Page' as const, label: 'Trash', href: routeHref({ name: 'trash' }) },
          ]
        : []),
      {
        id: 'page:voice',
        kind: 'Page',
        label: 'Voice',
        detail: 'cast Lina, narrate lessons',
        href: routeHref({ name: 'voice' }),
      },
      { id: 'page:unfiled', kind: 'Page', label: 'Not in a path', href: routeHref({ name: 'unfiled' }) },
      { id: 'page:import', kind: 'Page', label: 'Import & test', href: routeHref({ name: 'import' }) },
      { id: 'page:settings', kind: 'Page', label: 'Settings', href: routeHref({ name: 'settings' }) },
    ]
    const paths: Command[] = (catalog?.paths ?? []).map((path) => ({
      id: `path:${path.id}`,
      kind: 'Path',
      label: path.title,
      detail: `${path.lessonIds.length} ${path.lessonIds.length === 1 ? 'lesson' : 'lessons'}`,
      href: routeHref({ name: 'paths', pathId: path.id }),
    }))
    const lessons: Command[] = [...library.tutorials.values()].map((entry) => ({
      id: `lesson:${entry.id}`,
      kind: 'Lesson',
      label: entry.tutorial.title,
      detail: `${pathOf.get(entry.id) ?? 'Not in a path'} · ${entry.id}`,
      href: routeHref({ name: 'lesson', lessonId: entry.id }),
    }))
    return [...lessons, ...paths, ...pages]
  }, [library])

  const needle = query.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!needle) return commands.slice(0, 40)
    const score = (command: Command) => {
      const label = command.label.toLowerCase()
      if (label.startsWith(needle)) return 0
      if (label.includes(needle)) return 1
      return (command.detail ?? '').toLowerCase().includes(needle) ? 2 : 3
    }
    return commands
      .map((command) => ({ command, score: score(command) }))
      .filter((item) => item.score < 3)
      .sort((a, b) => a.score - b.score)
      .map((item) => item.command)
      .slice(0, 40)
  }, [commands, needle])

  const current = Math.min(active, Math.max(0, shown.length - 1))

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const open = (command: Command | undefined) => {
    if (!command) return
    window.location.hash = command.href
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="st-dialog st-palette"
      aria-label="Jump to"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === ref.current) onClose()
      }}
    >
      <input
        ref={input}
        className="st-palette__input"
        placeholder="Jump to a lesson, a path or a page…"
        aria-label="Jump to"
        role="combobox"
        aria-expanded="true"
        aria-controls="st-palette-list"
        aria-activedescendant={shown[current] ? `st-palette-${shown[current].id}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive(Math.min(current + 1, shown.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive(Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            open(shown[current])
          }
        }}
      />
      <ul ref={list} id="st-palette-list" className="st-palette__list" role="listbox">
        {shown.map((command, index) => (
          <li
            key={command.id}
            id={`st-palette-${command.id}`}
            role="option"
            aria-selected={index === current}
            className={`st-palette__item ${index === current ? 'is-active' : ''}`}
            onMouseEnter={() => setActive(index)}
            onClick={() => open(command)}
          >
            <span className="st-palette__kind">{command.kind}</span>
            <span className="st-palette__label">{command.label}</span>
            {command.detail ? <span className="st-palette__detail">{command.detail}</span> : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="st-palette__empty">Nothing matches “{query.trim()}”.</li> : null}
      </ul>
      <p className="st-palette__hint">↑ ↓ to choose · Enter to open · Esc to close</p>
    </dialog>
  )
}
