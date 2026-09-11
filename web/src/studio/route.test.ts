import { describe, expect, it } from 'vitest'

import { parseRoute, routeHref, type Route } from './route'

describe('parseRoute', () => {
  it('falls back to the paths overview', () => {
    expect(parseRoute('')).toEqual({ name: 'paths', pathId: null })
    expect(parseRoute('#/nowhere')).toEqual({ name: 'paths', pathId: null })
    expect(parseRoute('#/lessons')).toEqual({ name: 'paths', pathId: null })
  })

  it('reads each screen', () => {
    expect(parseRoute('#/paths/houses')).toEqual({ name: 'paths', pathId: 'houses' })
    expect(parseRoute('#/lessons/simple-house')).toEqual({
      name: 'lesson',
      lessonId: 'simple-house',
    })
    expect(parseRoute('#/import')).toEqual({ name: 'import' })
  })

  it('survives malformed escapes', () => {
    expect(parseRoute('#/lessons/%E0%A4%A')).toEqual({ name: 'lesson', lessonId: '%E0%A4%A' })
  })

  it('round-trips with routeHref', () => {
    const routes: Route[] = [
      { name: 'paths', pathId: null },
      { name: 'paths', pathId: 'houses' },
      { name: 'lesson', lessonId: 'simple-house' },
      { name: 'import' },
    ]
    for (const route of routes) expect(parseRoute(routeHref(route))).toEqual(route)
  })
})
