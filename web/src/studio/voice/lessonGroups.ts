/**
 * The lesson picker on the Voice page, grouped the way the creator thinks about
 * lessons: by path, in teaching order, with anything unfiled at the end.
 *
 * It takes plain shapes rather than the Studio's `Library` so it stays a small
 * pure function: the page passes the curriculum's paths and the lessons it
 * actually holds, and gets back the `<optgroup>`s to render.
 */

export interface PickableLesson {
  id: string
  title: string
}

export interface PickerPath {
  id: string
  title: string
  /** Lessons in unlock order, as the curriculum lists them. */
  lessonIds: string[]
}

export interface LessonGroup {
  label: string
  lessons: PickableLesson[]
}

/** The group anything outside a path falls into. */
export const UNFILED_GROUP = 'Not in a path'

export function groupLessonsByPath(
  paths: readonly PickerPath[],
  lessons: readonly PickableLesson[],
): LessonGroup[] {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const placed = new Set<string>()
  const groups: LessonGroup[] = []

  for (const path of paths) {
    const inPath: PickableLesson[] = []
    for (const id of path.lessonIds) {
      // A path may list a lesson that is not in the workspace (or lists one
      // twice); the picker can only offer what is really there.
      const lesson = byId.get(id)
      if (!lesson || placed.has(id)) continue
      placed.add(id)
      inPath.push(lesson)
    }
    if (inPath.length > 0) groups.push({ label: path.title, lessons: inPath })
  }

  const unfiled = lessons
    .filter((lesson) => !placed.has(lesson.id))
    .sort((a, b) => a.title.localeCompare(b.title))
  if (unfiled.length > 0) groups.push({ label: UNFILED_GROUP, lessons: unfiled })

  return groups
}

/** How many lessons the picker offers, for "12 lessons" under the select. */
export function countLessons(groups: readonly LessonGroup[]): number {
  return groups.reduce((total, group) => total + group.lessons.length, 0)
}
