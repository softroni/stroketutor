import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ImportView } from '../app/ImportView'
import type { Catalog } from '../catalog/types'

import { saveCatalog } from './api'
import { LessonWorkspace } from './LessonWorkspace'
import { buildLibrary, type Library } from './library'
import { NewLessonView } from './NewLessonView'
import { PathsView } from './PathsView'
import { parseRoute, routeHref, type Route } from './route'
import { SettingsView } from './SettingsView'
import { loadSources } from './sources'
import './studio.css'

/**
 * StrokeTutor Studio: the private authoring tool built around the existing
 * player (master plan Part III). Paths and the Lesson Workspace are the main
 * surfaces; the original importer stays available for testing arbitrary JSON.
 */
export function Studio() {
  const [library, setLibrary] = useState<Library | null>(null)
  const route = useHashRoute()

  /** Reads shared/ again: at start-up, and after every save, so the Studio shows what is on disk. */
  const reload = useCallback(async () => {
    setLibrary(buildLibrary(await loadSources()))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * Applies one curriculum change to the catalog as it is on disk and saves it
   * at once. Nothing is held unsaved, so no other save can sweep a pending
   * change away, and the writer's version check refuses a stale catalog.
   */
  const editCatalog = useCallback(
    async (change: (catalog: Catalog) => Catalog) => {
      if (!library?.catalog) throw new Error('The catalog could not be read, so it cannot be changed.')
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

  const openCreated = useCallback(
    async (lessonId: string) => {
      await reload()
      window.location.hash = routeHref({ name: 'lesson', lessonId })
    },
    [reload],
  )

  let screen: ReactNode
  if (!library) {
    screen = <p className="st-empty">Reading shared/…</p>
  } else {
    switch (route.name) {
      case 'paths':
        screen = (
          <PathsView library={library} selectedPathId={route.pathId} onEdit={editCatalog} />
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
      case 'settings':
        screen = <SettingsView library={library} />
        break
      case 'import':
        screen = <ImportView samples={library.samples} />
        break
    }
  }

  const current = (name: Route['name'] | Route['name'][]) =>
    (Array.isArray(name) ? name : [name]).includes(route.name) ? 'page' : undefined

  return (
    <div className="st-studio">
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
          {library && !library.writable ? (
            <span className="st-pill" title="Saving needs the Studio server: run npm run dev.">
              Read-only copy
            </span>
          ) : null}
          <nav className="st-studio__nav" aria-label="Studio">
            <a href={routeHref({ name: 'paths', pathId: null })} aria-current={current(['paths', 'lesson'])}>
              Paths
            </a>
            <a href={routeHref({ name: 'new', pathId: null })} aria-current={current('new')}>
              New lesson
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
      <main className="st-studio__main">{screen}</main>
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
