import type { LessonContext, PreviousLesson } from './prompts/lessonPrompt'
import type { LibrarySnapshot } from './repoWriter'

interface LoosePath {
  id?: unknown
  title?: unknown
  lessonIds?: unknown
}

interface LooseLesson {
  id?: unknown
  objective?: unknown
}

interface LooseTutorial {
  title?: unknown
  steps?: { strokes?: unknown }[]
}

/**
 * The curriculum around a new lesson, read from `shared/` as it is on disk, so
 * the model can pitch the lesson as a modest step after the previous ones
 * (§16). Context is a hint, never a gate: unreadable files are skipped.
 */
export function lessonContext(
  library: LibrarySnapshot,
  pathId: string | null,
  position: number,
  goal: string,
  constraints: string,
): LessonContext {
  const paths = (parse(library.paths?.text) as { paths?: LoosePath[] } | null)?.paths ?? []
  const lessons = (parse(library.lessons?.text) as { lessons?: LooseLesson[] } | null)?.lessons ?? []
  const path = pathId ? paths.find((candidate) => candidate.id === pathId) : undefined
  const pathLessonIds = Array.isArray(path?.lessonIds) ? (path.lessonIds as unknown[]).map(String) : []
  const at = Math.max(0, Math.min(position, pathLessonIds.length))

  const previous = pathLessonIds.slice(0, at).flatMap((id): PreviousLesson[] => {
    const file = library.tutorials.find((tutorial) => tutorial.fileName === `${id}.json`)
    const tutorial = parse(file?.text) as LooseTutorial | null
    if (!tutorial || !Array.isArray(tutorial.steps)) return []
    const lesson = lessons.find((candidate) => candidate.id === id)
    return [
      {
        title: String(tutorial.title ?? id),
        objective: typeof lesson?.objective === 'string' ? lesson.objective : '',
        steps: tutorial.steps.length,
        strokes: tutorial.steps.reduce(
          (sum, step) => sum + (Array.isArray(step?.strokes) ? step.strokes.length : 0),
          0,
        ),
      },
    ]
  })

  return {
    pathTitle: typeof path?.title === 'string' ? path.title : null,
    position: at,
    previous,
    goal,
    constraints,
  }
}

function parse(text: string | undefined): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
