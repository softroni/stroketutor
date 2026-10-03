import { describe, expect, it } from 'vitest'

import { parseRoute, routeHref, type Route } from './route'

describe('parseRoute', () => {
  it('opens Today when there is no screen named, or one it does not know', () => {
    expect(parseRoute('')).toEqual({ name: 'today', day: null })
    expect(parseRoute('#/')).toEqual({ name: 'today', day: null })
    expect(parseRoute('#/nowhere')).toEqual({ name: 'today', day: null })
    expect(parseRoute('#/lessons')).toEqual({ name: 'today', day: null })
    // Paths keeps its own address.
    expect(parseRoute('#/paths')).toEqual({ name: 'paths', pathId: null })
  })

  it('reads each screen', () => {
    expect(parseRoute('#/paths/houses')).toEqual({ name: 'paths', pathId: 'houses' })
    expect(parseRoute('#/lessons/simple-house')).toEqual({
      name: 'lesson',
      lessonId: 'simple-house',
    })
    expect(parseRoute('#/import')).toEqual({ name: 'import' })
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' })
    expect(parseRoute('#/publish')).toEqual({ name: 'publish' })
    expect(parseRoute('#/voice')).toEqual({ name: 'voice' })
    expect(parseRoute('#/unfiled')).toEqual({ name: 'unfiled' })
    expect(parseRoute('#/trash')).toEqual({ name: 'trash' })
    expect(parseRoute('#/new')).toEqual({ name: 'new', pathId: null })
    expect(parseRoute('#/new/houses')).toEqual({ name: 'new', pathId: 'houses' })
    expect(parseRoute('#/screenshots')).toEqual({ name: 'screenshots', device: 'iphone', shot: null })
    expect(parseRoute('#/screenshots/ipad/keep')).toEqual({ name: 'screenshots', device: 'ipad', shot: 'keep' })
    expect(parseRoute('#/learners')).toEqual({ name: 'learners', period: 'day', date: null })
    expect(parseRoute('#/learners/week')).toEqual({ name: 'learners', period: 'week', date: null })
    expect(parseRoute('#/learners/month/2026-10-02')).toEqual({ name: 'learners', period: 'month', date: '2026-10-02' })
    expect(parseRoute('#/learners/day/yesterday')).toEqual({ name: 'learners', period: 'day', date: null })
    expect(parseRoute('#/learners/week/2026-10-02?lesson=cloud')).toEqual({
      name: 'learners',
      period: 'week',
      date: '2026-10-02',
      lesson: 'cloud',
    })
    expect(parseRoute('#/learners?only=price')).toEqual({ name: 'learners', period: 'day', date: null, only: 'price' })
    expect(parseRoute('#/learners?only=nonsense')).toEqual({ name: 'learners', period: 'day', date: null })
    expect(parseRoute('#/learners?only=now')).toEqual({ name: 'learners', period: 'day', date: null, only: 'now' })
    expect(parseRoute('#/learners?where=keyword-2339019453')).toEqual({ name: 'learners', period: 'day', date: null, where: 'keyword-2339019453' })
    expect(parseRoute('#/learners?where=somewhere')).toEqual({ name: 'learners', period: 'day', date: null })
    expect(parseRoute('#/learners?age=6to9')).toEqual({ name: 'learners', period: 'day', date: null, age: '6to9' })
    expect(parseRoute('#/learners?age=adult')).toEqual({ name: 'learners', period: 'day', date: null })
    expect(parseRoute('#/screenshots/watch')).toEqual({ name: 'screenshots', device: 'iphone', shot: null })
    expect(parseRoute('#/today')).toEqual({ name: 'today', day: null })
    expect(parseRoute('#/today/2026-09-27')).toEqual({ name: 'today', day: '2026-09-27' })
    expect(parseRoute('#/today/yesterday')).toEqual({ name: 'today', day: null })
    expect(parseRoute('#/social')).toEqual({ name: 'social' })
    expect(parseRoute('#/docs')).toEqual({ name: 'docs', section: null })
    expect(parseRoute('#/docs/studio-cli')).toEqual({ name: 'docs', section: 'studio-cli' })
  })

  it('reads the planned lesson New lesson is opened to fill', () => {
    expect(parseRoute('#/new?lesson=sun')).toEqual({ name: 'new', pathId: null, lessonId: 'sun' })
    expect(parseRoute('#/new?lesson=')).toEqual({ name: 'new', pathId: null })
    expect(routeHref({ name: 'new', pathId: 'houses', lessonId: 'sun' })).toBe('#/new?lesson=sun')
  })

  it('survives malformed escapes', () => {
    expect(parseRoute('#/lessons/%E0%A4%A')).toEqual({ name: 'lesson', lessonId: '%E0%A4%A' })
  })

  it('round-trips with routeHref', () => {
    const routes: Route[] = [
      { name: 'paths', pathId: null },
      { name: 'paths', pathId: 'houses' },
      { name: 'lesson', lessonId: 'simple-house' },
      { name: 'new', pathId: null },
      { name: 'new', pathId: 'houses' },
      { name: 'new', pathId: null, lessonId: 'sun' },
      { name: 'unfiled' },
      { name: 'publish' },
      { name: 'voice' },
      { name: 'trash' },
      { name: 'settings' },
      { name: 'import' },
      { name: 'screenshots', device: 'iphone', shot: null },
      { name: 'screenshots', device: 'ipad', shot: null },
      { name: 'screenshots', device: 'iphone', shot: 'learn' },
      { name: 'today', day: null },
      { name: 'today', day: '2026-09-27' },
      { name: 'learners', period: 'day', date: null },
      { name: 'learners', period: 'week', date: null },
      { name: 'learners', period: 'month', date: '2026-10-02' },
      { name: 'learners', period: 'day', date: null, lesson: 'watermelon-slice' },
      { name: 'learners', period: 'day', date: '2026-10-02', lesson: 'cloud' },
      { name: 'learners', period: 'week', date: null, only: 'price' },
      { name: 'learners', period: 'day', date: '2026-10-02', lesson: 'cloud', only: 'photos' },
      { name: 'learners', period: 'week', date: null, where: 'country-US' },
      { name: 'learners', period: 'day', date: '2026-10-02', where: 'organic', age: '18plus' },
      { name: 'social' },
      { name: 'docs', section: null },
      { name: 'docs', section: 'posthog' },
    ]
    for (const route of routes) expect(parseRoute(routeHref(route))).toEqual(route)
  })
})
