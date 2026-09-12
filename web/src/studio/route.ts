/**
 * The Studio's screens, addressed by URL hash so a lesson can be bookmarked and
 * the browser's back button works without a router dependency.
 *
 * `#/paths/<pathId>` · `#/unfiled` · `#/lessons/<lessonId>` · `#/new/<pathId>` · `#/publish` · `#/trash` ·
 * `#/settings` · `#/import`
 */
export type Route =
  | { name: 'paths'; pathId: string | null }
  | { name: 'unfiled' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'new'; pathId: string | null }
  | { name: 'publish' }
  | { name: 'trash' }
  | { name: 'settings' }
  | { name: 'import' }

export function parseRoute(hash: string): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(safeDecode)

  switch (parts[0]) {
    case 'lessons':
      if (parts[1]) return { name: 'lesson', lessonId: parts[1] }
      break
    case 'new':
      return { name: 'new', pathId: parts[1] ?? null }
    case 'unfiled':
      return { name: 'unfiled' }
    case 'publish':
      return { name: 'publish' }
    case 'trash':
      return { name: 'trash' }
    case 'settings':
      return { name: 'settings' }
    case 'import':
      return { name: 'import' }
    case 'paths':
      return { name: 'paths', pathId: parts[1] ?? null }
  }
  return { name: 'paths', pathId: null }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'paths':
      return route.pathId ? `#/paths/${encodeURIComponent(route.pathId)}` : '#/paths'
    case 'lesson':
      return `#/lessons/${encodeURIComponent(route.lessonId)}`
    case 'new':
      return route.pathId ? `#/new/${encodeURIComponent(route.pathId)}` : '#/new'
    case 'unfiled':
      return '#/unfiled'
    case 'publish':
      return '#/publish'
    case 'trash':
      return '#/trash'
    case 'settings':
      return '#/settings'
    case 'import':
      return '#/import'
  }
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}
