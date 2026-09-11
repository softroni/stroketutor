import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ImportView } from '../app/ImportView'
import type { Catalog } from '../catalog/types'

import { LessonWorkspace } from './LessonWorkspace'
import { loadLibrary } from './library'
import { PathsView } from './PathsView'
import { parseRoute, routeHref, type Route } from './route'
import './studio.css'

/**
 * StrokeTutor Studio: the private authoring tool built around the existing
 * player (master plan Part III). Paths and the Lesson Workspace are the main
 * surfaces; the original importer stays available for testing arbitrary JSON.
 */
export function Studio() {
  // Everything under shared/ is bundled, so it is read and validated once.
  const library = useMemo(() => loadLibrary(), [])
  const [catalog, setCatalog] = useState<Catalog | null>(library.catalog)
  const [orderChanged, setOrderChanged] = useState(false)
  const route = useHashRoute()

  const handleReorder = useCallback((pathId: string, lessonIds: string[]) => {
    setCatalog((current) =>
      current
        ? {
            ...current,
            paths: current.paths.map((path) => (path.id === pathId ? { ...path, lessonIds } : path)),
          }
        : current,
    )
    setOrderChanged(true)
  }, [])

  let screen: ReactNode
  switch (route.name) {
    case 'paths':
      screen = (
        <PathsView
          library={library}
          catalog={catalog}
          selectedPathId={route.pathId}
          orderChanged={orderChanged}
          onReorder={handleReorder}
        />
      )
      break
    case 'lesson':
      screen = (
        <LessonWorkspace
          key={route.lessonId}
          library={library}
          catalog={catalog}
          lessonId={route.lessonId}
        />
      )
      break
    case 'import':
      screen = <ImportView />
      break
  }

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
        <nav className="st-studio__nav" aria-label="Studio">
          <a
            href={routeHref({ name: 'paths', pathId: null })}
            aria-current={route.name === 'import' ? undefined : 'page'}
          >
            Paths
          </a>
          <a href={routeHref({ name: 'import' })} aria-current={route.name === 'import' ? 'page' : undefined}>
            Import &amp; test
          </a>
        </nav>
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
