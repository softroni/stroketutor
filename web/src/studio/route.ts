/**
 * The Studio's screens, addressed by URL hash so a lesson can be bookmarked and
 * the browser's back button works without a router dependency.
 *
 * `#/paths/<pathId>` · `#/unfiled` · `#/lessons/<lessonId>` · `#/new/<pathId>` ·
 * `#/new?lesson=<lessonId>` · `#/publish` · `#/voice` · `#/trash` · `#/settings` · `#/import`
 *
 * One screen takes a named parameter rather than a segment: New lesson can be
 * opened to fill a planned lesson, which is a way of arriving at the screen
 * rather than another screen, so it reads as a query.
 */
export type Route =
  | { name: 'paths'; pathId: string | null }
  | { name: 'unfiled' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'new'; pathId: string | null; lessonId?: string | null }
  | { name: 'publish' }
  | { name: 'voice' }
  | { name: 'trash' }
  | { name: 'settings' }
  | { name: 'import' }

export function parseRoute(hash: string): Route {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(safeDecode)
  const params = new URLSearchParams(search)

  switch (parts[0]) {
    case 'lessons':
      if (parts[1]) return { name: 'lesson', lessonId: parts[1] }
      break
    case 'new': {
      const lessonId = params.get('lesson')
      return { name: 'new', pathId: parts[1] ?? null, ...(lessonId ? { lessonId } : {}) }
    }
    case 'unfiled':
      return { name: 'unfiled' }
    case 'publish':
      return { name: 'publish' }
    case 'voice':
      return { name: 'voice' }
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
      if (route.lessonId) return `#/new?lesson=${encodeURIComponent(route.lessonId)}`
      return route.pathId ? `#/new/${encodeURIComponent(route.pathId)}` : '#/new'
    case 'unfiled':
      return '#/unfiled'
    case 'publish':
      return '#/publish'
    case 'voice':
      return '#/voice'
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
