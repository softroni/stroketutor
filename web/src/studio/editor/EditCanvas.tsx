import { useMemo } from 'react'

import { StrokeCanvas, type RenderStroke } from '../../player/StrokeCanvas'
import { resolveStyle } from '../../schema/types'

import type { EditableStroke, EditableTutorial } from './ops'
import { useReplay } from './useReplay'

/**
 * Temporary authoring colours, one per step, readable on the default paper.
 * They exist only in Edit mode (§18); the learner never sees them.
 */
export const STEP_COLORS = [
  '#2B6CB0',
  '#C05621',
  '#2F855A',
  '#9B2C2C',
  '#6B46C1',
  '#B7791F',
  '#2C7A7B',
  '#B83280',
]

export const stepColor = (stepIndex: number) => STEP_COLORS[stepIndex % STEP_COLORS.length]

const SELECTED_COLOR = '#D7263D'
const SELECTED_HALO = 'rgba(215, 38, 61, 0.18)'

/** A request to animate some strokes; a new `runId` replays them again. */
export interface Replay {
  uids: string[]
  runId: number
}

export interface EditCanvasProps {
  doc: EditableTutorial
  selection: ReadonlySet<string>
  /** Colour strokes by step. Off, the drawing looks exactly as a learner will see it. */
  colorBySteps: boolean
  replay: Replay | null
  /** `uid` null means the paper itself was clicked. `additive` is a shift/⌘/ctrl click. */
  onSelect: (uid: string | null, additive: boolean) => void
}

interface Placed {
  stroke: EditableStroke
  stepIndex: number
}

const toRender = ({ stroke }: Placed): RenderStroke => ({
  key: stroke.uid,
  d: stroke.d,
  lineWidth: stroke.lineWidth,
})

/**
 * The drawing as something to point at: every stroke whole and clickable, with
 * a replay mode that animates a stroke, a step or the lesson through the real
 * `StrokeCanvas`, so timing looks exactly as it will in playback.
 */
export function EditCanvas({ doc, selection, colorBySteps, replay, onSelect }: EditCanvasProps) {
  const style = useMemo(() => resolveStyle(doc.style), [doc.style])
  const placed = useMemo<Placed[]>(
    () => doc.steps.flatMap((step, stepIndex) => step.strokes.map((stroke) => ({ stroke, stepIndex }))),
    [doc],
  )

  const replayUids = useMemo(() => new Set(replay?.uids ?? []), [replay])
  const replaying = placed.filter((entry) => replayUids.has(entry.stroke.uid))
  const state = useReplay(
    replaying.map((entry) => entry.stroke.duration),
    replay?.runId ?? null,
  )
  const showReplay = replay !== null && !(state.runId === replay.runId && state.done)

  const { width, height } = doc.canvas
  const border = Math.max(width, height) * 0.003
  const radius = Math.min(width, height) * 0.028
  const hitWidth = Math.max(width, height) * 0.025

  if (showReplay) {
    const current = state.runId === replay.runId
    return (
      <StrokeCanvas
        className="st-canvas"
        canvas={doc.canvas}
        strokeColor={style.strokeColor}
        backgroundColor={style.backgroundColor}
        completed={placed.filter((entry) => !replayUids.has(entry.stroke.uid)).map(toRender)}
        strokes={replaying.map(toRender)}
        activeIndex={current ? state.strokeIndex : 0}
        activeProgress={current ? state.progress : 0}
        showPencil
        title={`${doc.title}, replaying`}
      />
    )
  }

  return (
    <svg
      className="st-canvas st-edit-canvas"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`${doc.title}. Click a stroke to select it; shift-click to add to the selection.`}
      onClick={() => onSelect(null, false)}
    >
      <rect
        x={border / 2}
        y={border / 2}
        width={width - border}
        height={height - border}
        rx={radius}
        ry={radius}
        fill={style.backgroundColor}
        stroke="rgba(43, 43, 43, 0.12)"
        strokeWidth={border}
      />
      {placed.map(({ stroke, stepIndex }) => {
        const selected = selection.has(stroke.uid)
        const color = selected
          ? SELECTED_COLOR
          : colorBySteps
            ? stepColor(stepIndex)
            : style.strokeColor
        return (
          <g
            key={stroke.uid}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(stroke.uid, event.shiftKey || event.metaKey || event.ctrlKey)
            }}
          >
            {selected ? (
              <path
                d={stroke.d}
                fill="none"
                stroke={SELECTED_HALO}
                strokeWidth={stroke.lineWidth * 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <path
              d={stroke.d}
              fill="none"
              stroke={color}
              strokeWidth={stroke.lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={selection.size > 0 && !selected ? 0.45 : 1}
            />
            {/* A wide invisible twin, so thin strokes are easy to hit. */}
            <path
              className="st-edit-canvas__hit"
              d={stroke.d}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(stroke.lineWidth * 2.5, hitWidth)}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="stroke"
            >
              <title>{`Step ${stepIndex + 1}: ${doc.steps[stepIndex].title}`}</title>
            </path>
          </g>
        )
      })}
    </svg>
  )
}
