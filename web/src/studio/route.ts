/**
 * The Studio's screens, addressed by URL hash so a lesson can be bookmarked and
 * the browser's back button works without a router dependency.
 *
 * `#/paths/<pathId>` · `#/unfiled` · `#/lessons/<lessonId>` · `#/new/<pathId>` ·
 * `#/new?lesson=<lessonId>` · `#/publish` · `#/voice` · `#/trash` · `#/settings` · `#/import` ·
 * `#/screenshots[/<device>[/<shot>]]` · `#/today[/<YYYY-MM-DD>]` ·
 * `#/learners[/<day|week|month>[/<YYYY-MM-DD>]][?lesson=<lessonId>&only=<number>&where=<place>]` ·
 * `#/social` · `#/docs[/<tool>]`
 *
 * Today is the Studio's front page: no hash, or one it does not know, opens it.
 *
 * One screen takes a named parameter rather than a segment: New lesson can be
 * opened to fill a planned lesson, which is a way of arriving at the screen
 * rather than another screen, so it reads as a query.
 */
import { isWhere, ONLY, type Only, type Period, type Where } from './learners'
import type { ScreenshotDevice } from './screenshots'

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
  /** The App Store screenshots of one device, with `shot` open full size. */
  | { name: 'screenshots'; device: ScreenshotDevice; shot: string | null }
  /** How the app stands and what Claude is doing, written by Claude every morning; `day` shows a past one. */
  | { name: 'today'; day: string | null }
  /**
   * What learners did, read from PostHog: a day, a week or a month; `date` null for the current one,
   * `lesson` narrowing it to the learners who finished that lesson, and `only` to those one number counts.
   */
  | { name: 'learners'; period: Period; date: string | null; lesson?: string; only?: Only; where?: Where }
  /** Every post on social media, day by day, with a link to each on each platform. */
  | { name: 'social' }
  /** Every command line and MCP server the repo uses; `section` scrolls to one tool. */
  | { name: 'docs'; section: string | null }

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
    case 'screenshots':
      return { name: 'screenshots', device: parts[1] === 'ipad' ? 'ipad' : 'iphone', shot: parts[2] ?? null }
    case 'today':
      return { name: 'today', day: parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) ? parts[1] : null }
    case 'learners': {
      const period: Period = parts[1] === 'week' || parts[1] === 'month' ? parts[1] : 'day'
      const date = parts[2] && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) ? parts[2] : null
      const lesson = params.get('lesson')
      const only = ONLY.find((candidate) => candidate === params.get('only'))
      const where = params.get('where')
      return {
        name: 'learners',
        period,
        date,
        ...(lesson ? { lesson } : {}),
        ...(only ? { only } : {}),
        ...(where && isWhere(where) ? { where } : {}),
      }
    }
    case 'social':
      return { name: 'social' }
    case 'docs':
      return { name: 'docs', section: parts[1] ?? null }
    case 'paths':
      return { name: 'paths', pathId: parts[1] ?? null }
  }
  return { name: 'today', day: null }
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
    case 'screenshots':
      if (route.shot) return `#/screenshots/${route.device}/${encodeURIComponent(route.shot)}`
      return route.device === 'iphone' ? '#/screenshots' : `#/screenshots/${route.device}`
    case 'today':
      return route.day ? `#/today/${route.day}` : '#/today'
    case 'learners': {
      const params = new URLSearchParams()
      if (route.lesson) params.set('lesson', route.lesson)
      if (route.only) params.set('only', route.only)
      if (route.where) params.set('where', route.where)
      const query = params.size ? `?${params.toString()}` : ''
      if (route.date) return `#/learners/${route.period}/${route.date}${query}`
      return `${route.period === 'day' ? '#/learners' : `#/learners/${route.period}`}${query}`
    }
    case 'social':
      return '#/social'
    case 'docs':
      return route.section ? `#/docs/${encodeURIComponent(route.section)}` : '#/docs'
  }
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}
