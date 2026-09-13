import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ImportView } from '../app/ImportView'
import { readyCount } from '../catalog/publishing'
import type { Catalog } from '../catalog/types'

import { adoptShared, saveCatalog } from './api'
import { CommandPalette } from './CommandPalette'
import { LessonWorkspace } from './LessonWorkspace'
import { buildLibrary, type Library } from './library'
import { NewLessonView } from './NewLessonView'
import { PathsView } from './PathsView'
import { PublishView } from './PublishView'
import { parseRoute, routeHref, type Route } from './route'
import { SettingsView } from './SettingsView'
import { loadSources } from './sources'
import { TrashView } from './TrashView'
import { VoiceView } from './VoiceView'
// Imported here, in this order, so each sheet overrides the ones before it:
// a component's own CSS import would load before studio.css and lose to it.
import './studio.css'
import './publishing.css'
import './paths.css'
import './workspace.css'
import './forms.css'
import './voice.css'

/**
 * StrokeTutor Studio: the private authoring tool built around the existing
 * player (master plan Part III). Paths and the Lesson Workspace are the main
 * surfaces. Work happens in the local workspace; Publish is the one way into
 * `shared/`. The original importer stays available for testing arbitrary JSON.
 */
export function Studio() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [adoptError, setAdoptError] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const route = useHashRoute()

  // ⌘K opens the palette from anywhere, even while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setPaletteOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /** Reads the library again: at start-up, and after every change, so the Studio shows what is stored. */
  const reload = useCallback(async () => {
    setLibrary(buildLibrary(await loadSources()))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * Applies one curriculum change to the working curriculum as it is stored,
   * and saves it at once. Nothing is held unsaved, so no other save can sweep
   * a pending change away, and the version check refuses a stale curriculum.
   */
  const editCatalog = useCallback(
    async (change: (catalog: Catalog) => Catalog) => {
      if (!library?.catalog) throw new Error('The curriculum could not be read, so it cannot be changed.')
      const next = change(library.catalog)
      await saveCatalog(
        { catalogVersion: 1, paths: next.paths },
        { catalogVersion: 1, lessons: next.lessons },
        { paths: library.catalogEtags.paths ?? null, lessons: library.catalogEtags.lessons ?? null },
      )
      await reload()
    },
    [library, reload],
  )

  const adopt = useCallback(async () => {
    setAdoptError(null)
    try {
      await adoptShared()
      await reload()
    } catch (error) {
      setAdoptError(error instanceof Error ? error.message : String(error))
    }
  }, [reload])

  const openCreated = useCallback(
    async (lessonId: string) => {
      await reload()
      window.location.hash = routeHref({ name: 'lesson', lessonId })
    },
    [reload],
  )

  let screen: ReactNode
  if (!library) {
    screen = <p className="st-empty">Reading the workspace…</p>
  } else {
    switch (route.name) {
      case 'paths':
      case 'unfiled':
        screen = (
          <PathsView
            library={library}
            selectedPathId={route.name === 'paths' ? route.pathId : null}
            unfiled={route.name === 'unfiled'}
            onEdit={editCatalog}
            onReload={reload}
          />
        )
        break
      case 'lesson':
        screen = (
          <LessonWorkspace
            key={route.lessonId}
            library={library}
            catalog={library.catalog}
            lessonId={route.lessonId}
            onSaved={reload}
          />
        )
        break
      case 'new':
        screen = (
          <NewLessonView
            key={route.pathId ?? ''}
            library={library}
            initialPathId={route.pathId}
            onCreated={openCreated}
          />
        )
        break
      case 'publish':
        screen = <PublishView library={library} onPublished={reload} onAdopt={adopt} />
        break
      case 'voice':
        screen = <VoiceView library={library} />
        break
      case 'trash':
        screen = <TrashView library={library} onChanged={reload} />
        break
      case 'settings':
        screen = <SettingsView library={library} />
        break
      case 'import':
        screen = <ImportView samples={library.samples} library={library} onCreated={openCreated} />
        break
    }
  }

  const current = (name: Route['name'] | Route['name'][]) =>
    (Array.isArray(name) ? name : [name]).includes(route.name) ? 'page' : undefined
  const toPublish = library ? readyCount(library.publishing.pending) : 0

  return (
    <div className={`st-studio ${route.name === 'lesson' ? 'st-studio--fill' : ''}`}>
      <header className="st-studio__bar">
        <a className="st-studio__brand" href={routeHref({ name: 'paths', pathId: null })}>
          <span className="st-studio__mark" aria-hidden="true">
            ✎
          </span>
          <span>
            <span className="st-studio__name">StrokeTutor Studio</span>
            <span className="st-studio__tagline">Private lesson authoring</span>
          </span>
        </a>
        <div className="st-studio__end">
          {library ? (
            <button
              type="button"
              className="st-palette-button"
              title="Jump to a lesson, a path or a page (⌘K)"
              onClick={() => setPaletteOpen(true)}
            >
              Jump to… <kbd>⌘K</kbd>
            </button>
          ) : null}
          {library && !library.writable ? (
            <span className="st-pill" title="Saving needs the Studio server: run npm run dev.">
              Read-only copy
            </span>
          ) : null}
          <nav className="st-studio__nav" aria-label="Studio">
            <a href={routeHref({ name: 'paths', pathId: null })} aria-current={current(['paths', 'unfiled', 'lesson', 'trash'])}>
              Paths
            </a>
            <a href={routeHref({ name: 'new', pathId: null })} aria-current={current('new')}>
              New lesson
            </a>
            {library?.writable ? (
              <a href={routeHref({ name: 'publish' })} aria-current={current('publish')}>
                Publish
                {toPublish > 0 ? (
                  <span className="st-nav-badge" aria-label={`${toPublish} ready`}>
                    {toPublish}
                  </span>
                ) : null}
              </a>
            ) : null}
            <a href={routeHref({ name: 'voice' })} aria-current={current('voice')}>
              Voice
            </a>
            <a href={routeHref({ name: 'import' })} aria-current={current('import')}>
              Import &amp; test
            </a>
            <a href={routeHref({ name: 'settings' })} aria-current={current('settings')}>
              Settings
            </a>
          </nav>
        </div>
      </header>
      {library?.publishing.sharedChangedOutside ? (
        <div className="st-banner" role="status">
          <span>
            <code>shared/Catalog</code> changed outside the Studio, by a git pull or a hand edit. Publishing waits
            until the Studio adopts it.
          </span>
          <button type="button" className="st-button st-button--compact" onClick={() => void adopt()}>
            Adopt shared/
          </button>
          {adoptError ? <span className="st-banner__error">{adoptError}</span> : null}
        </div>
      ) : null}
      <main className="st-studio__main">{screen}</main>
      {paletteOpen && library ? <CommandPalette library={library} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  )
}

function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return useMemo(() => parseRoute(hash), [hash])
}
