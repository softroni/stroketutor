import { useMemo } from 'react'

import { StrokeCanvas, type RenderFill, type RenderStroke } from '../../player/StrokeCanvas'
import { cssColor, resolveStyle } from '../../schema/types'

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

/** Replay speeds a creator can pick; `instant` lands on the final frame at once. */
export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 'instant'] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

export const replaySpeedLabel = (speed: ReplaySpeed) => (speed === 'instant' ? 'Instant' : `${speed}×`)

/** A request to animate some strokes; a new `runId` replays them again. */
export interface Replay {
  uids: string[]
  /** Steps replayed whole, so their colour fills go in after their strokes, even a step with no strokes. */
  wholeSteps: number[]
  runId: number
  /** What is being replayed, for the creator: "step 3", "the lesson", "2 strokes". */
  label: string
}

export interface EditCanvasProps {
  doc: EditableTutorial
  selection: ReadonlySet<string>
  /** Colour strokes by step. Off, the drawing looks exactly as a learner will see it. */
  colorBySteps: boolean
  /** Paint the v2 colour fills. Off, only the lines show, so the stroke structure is easier to read. */
  showFills: boolean
  replay: Replay | null
  speed: ReplaySpeed
  /** `uid` null means the paper itself was clicked. `additive` is a shift/⌘/ctrl click. */
  onSelect: (uid: string | null, additive: boolean) => void
  /** The creator wants the drawing back, whole and editable. */
  onStopReplay: () => void
  /** Replay the same thing again. */
  onReplayAgain: () => void
}

interface Placed {
  stroke: EditableStroke
  stepIndex: number
}

/**
 * One item of the lesson's timeline as the learner sees it: each step's
 * strokes in order, then that step's fills.
 */
type TimelineItem =
  | { kind: 'stroke'; stepIndex: number; duration: number; placed: Placed }
  | { kind: 'fill'; stepIndex: number; duration: number; fill: RenderFill }

/** The strokes and fills of one step that take part in a replay, animated together. */
interface Segment {
  stepIndex: number
  strokes: RenderStroke[]
  fills: RenderFill[]
  /** Where this segment starts in the flat list of replay durations. */
  start: number
  length: number
}

const toRender = ({ stroke }: Placed): RenderStroke => ({
  key: stroke.uid,
  d: stroke.d,
  lineWidth: stroke.lineWidth,
  ...(stroke.color !== undefined ? { color: cssColor(stroke.color) } : {}),
})

/**
 * The drawing as something to point at: every stroke whole and clickable, with
 * a replay mode that animates a stroke, a step or the lesson through the real
 * `StrokeCanvas`, so timing looks exactly as it will in playback. A replay
 * shows the paper as the learner would have it at that moment: what came
 * before is faded, what comes after is not yet on the page, and it stays on
 * its last frame until the creator dismisses it.
 */
export function EditCanvas({
  doc,
  selection,
  colorBySteps,
  showFills,
  replay,
  speed,
  onSelect,
  onStopReplay,
  onReplayAgain,
}: EditCanvasProps) {
  const style = useMemo(() => resolveStyle(doc.style), [doc.style])
  const timeline = useMemo<TimelineItem[]>(
    () =>
      doc.steps.flatMap((step, stepIndex) => [
        ...step.strokes.map<TimelineItem>((stroke) => ({
          kind: 'stroke',
          stepIndex,
          duration: stroke.duration,
          placed: { stroke, stepIndex },
        })),
        // v2 fills are shown as the learner will see them, beneath every stroke.
        // They are not selectable: the editor reshapes the teaching order of strokes.
        ...(showFills ? step.fills ?? [] : []).map<TimelineItem>((fill, fillIndex) => ({
          kind: 'fill',
          stepIndex,
          duration: fill.duration,
          fill: { key: `${stepIndex}:f${fillIndex}`, d: fill.d, color: cssColor(fill.color), fillRule: fill.fillRule },
        })),
      ]),
    [doc, showFills],
  )
  const placed = useMemo(
    () => timeline.flatMap((item) => (item.kind === 'stroke' ? [item.placed] : [])),
    [timeline],
  )
  const fills = useMemo(() => timeline.flatMap((item) => (item.kind === 'fill' ? [item.fill] : [])), [timeline])

  // ---------- The replay, cut into what is before, what animates and what is after ----------

  const plan = useMemo(() => {
    if (!replay) return null
    const uids = new Set(replay.uids)
    // A step's fills are part of the replay when the whole step is: a learner
    // only ever sees colour go in after every line of the step is drawn.
    const wholeSteps = new Set([
      ...replay.wholeSteps,
      ...doc.steps.flatMap((step, stepIndex) =>
        step.strokes.length > 0 && step.strokes.every((stroke) => uids.has(stroke.uid)) ? [stepIndex] : [],
      ),
    ])
    const replayed = (item: TimelineItem) =>
      item.kind === 'stroke' ? uids.has(item.placed.stroke.uid) : wholeSteps.has(item.stepIndex)
    const first = timeline.findIndex(replayed)
    if (first < 0) return null
    let last = first
    timeline.forEach((item, index) => {
      if (replayed(item)) last = index
    })

    const before: TimelineItem[] = []
    const segments: Segment[] = []
    const durations: number[] = []
    timeline.forEach((item, index) => {
      if (index > last) return
      if (!replayed(item)) {
        // Anything the learner would already have on the page, faded.
        before.push(item)
        return
      }
      let segment = segments[segments.length - 1]
      if (!segment || segment.stepIndex !== item.stepIndex) {
        segment = { stepIndex: item.stepIndex, strokes: [], fills: [], start: durations.length, length: 0 }
        segments.push(segment)
      }
      if (item.kind === 'stroke') segment.strokes.push(toRender(item.placed))
      else segment.fills.push(item.fill)
      segment.length += 1
      durations.push(item.duration)
    })
    const strokeCount = segments.reduce((sum, segment) => sum + segment.strokes.length, 0)
    return { before, segments, durations, strokeCount }
  }, [replay, timeline, doc])

  const state = useReplay(plan?.durations ?? [], replay?.runId ?? null, speed === 'instant' ? Infinity : speed)

  const { width, height } = doc.canvas
  const border = Math.max(width, height) * 0.003
  const radius = Math.min(width, height) * 0.028
  const hitWidth = Math.max(width, height) * 0.025

  if (replay && plan) {
    const current = state.runId === replay.runId
    const flatIndex = current ? state.strokeIndex : 0
    const progress = current ? state.progress : 0
    const done = current && state.done
    let active = plan.segments.findIndex((segment) => flatIndex < segment.start + segment.length)
    if (active < 0) active = plan.segments.length - 1
    const segment = plan.segments[active]
    const completed = [
      ...plan.before.flatMap((item) => (item.kind === 'stroke' ? [toRender(item.placed)] : [])),
      ...plan.segments.slice(0, active).flatMap((finished) => finished.strokes),
    ]
    const completedFills = [
      ...plan.before.flatMap((item) => (item.kind === 'fill' ? [item.fill] : [])),
      ...plan.segments.slice(0, active).flatMap((finished) => finished.fills),
    ]
    // Which stroke the pencil is on, counted across every segment, for the creator.
    const strokeNumber =
      plan.segments.slice(0, active).reduce((sum, finished) => sum + finished.strokes.length, 0) +
      Math.min(segment.strokes.length, flatIndex - segment.start + 1)

    return (
      <div className="st-replay" onClick={onStopReplay} title="Click to go back to editing">
        <StrokeCanvas
          className="st-canvas"
          canvas={doc.canvas}
          strokeColor={style.strokeColor}
          backgroundColor={style.backgroundColor}
          completed={completed}
          completedFills={completedFills}
          strokes={segment.strokes}
          fills={segment.fills}
          activeIndex={done ? segment.length : flatIndex - segment.start}
          activeProgress={done ? 1 : progress}
          showPencil
          title={`${doc.title}, replaying ${replay.label}`}
        />
        <div className="st-replay__chip" role="status" onClick={(event) => event.stopPropagation()}>
          <span className="st-replay__text">
            {done ? (
              <>
                <strong>{capitalise(replay.label)}</strong> drawn, as the learner sees it
              </>
            ) : (
              <>
                Replaying <strong>{replay.label}</strong> · stroke {strokeNumber} of {plan.strokeCount}
              </>
            )}
          </span>
          <button type="button" className="st-link-button" onClick={onReplayAgain} title="Replay again (Space)">
            ↻ Again
          </button>
          <button type="button" className="st-link-button" onClick={onStopReplay} title="Back to editing (Esc)">
            ✕ Done
          </button>
        </div>
      </div>
    )
  }

  const editCanvas = (
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
      <g pointerEvents="none" opacity={selection.size > 0 ? 0.45 : 1}>
        {fills.map((fill) => (
          <path key={fill.key} d={fill.d} fill={fill.color} fillRule={fill.fillRule ?? 'nonzero'} stroke="none" />
        ))}
      </g>
      {placed.map(({ stroke, stepIndex }) => {
        const selected = selection.has(stroke.uid)
        const color = selected
          ? SELECTED_COLOR
          : colorBySteps
            ? stepColor(stepIndex)
            : stroke.color !== undefined
              ? cssColor(stroke.color)
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

  if (replay) {
    // Asked to replay something that has nothing to draw: a step of colour
    // alone while the fills are hidden.
    return (
      <>
        {editCanvas}
        <div className="st-replay__chip" role="status">
          <span className="st-replay__text">
            Nothing to draw for <strong>{replay.label}</strong>: it is colour only, and Lines only is on
          </span>
          <button type="button" className="st-link-button" onClick={onStopReplay} title="Back to editing (Esc)">
            ✕ Done
          </button>
        </div>
      </>
    )
  }

  return editCanvas
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
