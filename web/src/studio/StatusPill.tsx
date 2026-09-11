import type { LessonStatus } from '../catalog/types'

const LABELS: Record<LessonStatus, string> = {
  draft: 'Draft',
  'needs-review': 'Needs review',
  approved: 'Approved',
}

export function StatusPill({ status }: { status: LessonStatus }) {
  return <span className={`st-pill st-pill--${status}`}>{LABELS[status]}</span>
}
