import { describe, expect, it } from 'vitest'

import { countLessons, groupLessonsByPath, UNFILED_GROUP } from './lessonGroups'

const lessons = [
  { id: 'simple-house', title: 'A simple house' },
  { id: 'palm-tree-4', title: 'Palm tree' },
  { id: 'cat-face', title: 'Cat face' },
  { id: 'classic-red-car', title: 'Classic red car' },
]

describe('groupLessonsByPath', () => {
  it('keeps each path in its teaching order and puts the rest at the end', () => {
    const groups = groupLessonsByPath(
      [
        { id: 'houses', title: 'Houses', lessonIds: ['simple-house'] },
        { id: 'nature', title: 'Nature', lessonIds: ['palm-tree-4'] },
      ],
      lessons,
    )
    expect(groups).toEqual([
      { label: 'Houses', lessons: [{ id: 'simple-house', title: 'A simple house' }] },
      { label: 'Nature', lessons: [{ id: 'palm-tree-4', title: 'Palm tree' }] },
      {
        label: UNFILED_GROUP,
        lessons: [
          { id: 'cat-face', title: 'Cat face' },
          { id: 'classic-red-car', title: 'Classic red car' },
        ],
      },
    ])
  })

  it('offers only lessons that exist, and each of them once', () => {
    const groups = groupLessonsByPath(
      [
        { id: 'houses', title: 'Houses', lessonIds: ['simple-house', 'gone', 'simple-house'] },
        { id: 'also', title: 'Also houses', lessonIds: ['simple-house'] },
      ],
      [{ id: 'simple-house', title: 'A simple house' }],
    )
    expect(groups).toEqual([{ label: 'Houses', lessons: [{ id: 'simple-house', title: 'A simple house' }] }])
  })

  it('drops empty paths and returns nothing for an empty workspace', () => {
    expect(groupLessonsByPath([{ id: 'houses', title: 'Houses', lessonIds: [] }], [])).toEqual([])
  })

  it('counts what the picker offers', () => {
    expect(countLessons(groupLessonsByPath([], lessons))).toBe(4)
  })
})
