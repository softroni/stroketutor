import type { LessonState } from '../catalog/publishing'
import type { LessonStatus } from '../catalog/types'

const LABELS: Record<LessonStatus, string> = {
  planned: 'Planned',
  draft: 'Draft',
  'needs-review': 'Needs review',
  approved: 'Approved',
}

const TITLES: Partial<Record<LessonStatus, string>> = {
  planned: 'A place held in the path. Nothing has been drawn for it yet.',
}

export function StatusPill({ status }: { status: LessonStatus }) {
  return (
    <span className={`st-pill st-pill--${status}`} title={TITLES[status]}>
      {LABELS[status]}
    </span>
  )
}

/**
 * One badge for where a lesson is in its life: Draft → Needs review →
 * Approved while it lives in the workspace, then Published once it is in
 * `shared/`, and Published · edited while the workspace holds changes to it.
 */
export function LifecycleBadge({ status, state }: { status?: LessonStatus; state: LessonState }) {
  if (state === 'published') {
    return (
      <span className="st-pill st-pill--published" title="In shared/: tracked by git and shipped in the app.">
        Published
      </span>
    )
  }
  if (state === 'published-edited') {
    return (
      <span
        className="st-pill st-pill--edited"
        title="Published, with changes in your workspace that are not published yet."
      >
        Published · edited
      </span>
    )
  }
  if (!status) {
    return (
      <span className="st-pill" title="Not in the curriculum, so no path can list it.">
        Not catalogued
      </span>
    )
  }
  return <StatusPill status={status} />
}
