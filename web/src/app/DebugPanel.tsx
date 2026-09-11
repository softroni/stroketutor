import { useMemo, useState } from 'react'

import { StrokeCanvas, type CanvasPoint, type RenderStroke } from '../player/StrokeCanvas'
import { measurePathLength } from '../player/svgPath'
import { resolveStyle, totalDuration, totalStrokes, type Tutorial } from '../schema/types'

export interface DebugPanelProps {
  tutorial: Tutorial
  onClose: () => void
}

interface InspectorRow {
  key: string
  stepIndex: number
  strokeIndex: number
  stepTitle: string
  d: string
  duration: number
  lineWidth: number
  length: number
}

/**
 * Authoring aids for hand-written coordinates.
 *
 * Deliberately renders its own static canvas rather than reaching into the
 * player: the player takes a tutorial and nothing else, and a still, gridded
 * copy of the finished drawing is what you actually want to check coordinates
 * against while the animation plays next to it.
 */
export function DebugPanel({ tutorial, onClose }: DebugPanelProps) {
  const [showAll, setShowAll] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [cursor, setCursor] = useState<CanvasPoint | null>(null)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)

  const style = useMemo(() => resolveStyle(tutorial.style), [tutorial.style])

  const rows = useMemo<InspectorRow[]>(() => {
    const out: InspectorRow[] = []
    tutorial.steps.forEach((step, stepIndex) => {
      step.strokes.forEach((stroke, strokeIndex) => {
        out.push({
          key: `${stepIndex}:${strokeIndex}`,
          stepIndex,
          strokeIndex,
          stepTitle: step.title,
          d: stroke.d,
          duration: stroke.duration,
          lineWidth: stroke.lineWidth,
          length: measurePathLength(stroke.d),
        })
      })
    })
    return out
  }, [tutorial])

  const strokes = useMemo<RenderStroke[]>(
    () => rows.map((row) => ({ key: row.key, d: row.d, lineWidth: row.lineWidth })),
    [rows],
  )

  return (
    <aside className="st-debug">
      <header className="st-debug__header">
        <h2 className="st-debug__heading">Debug</h2>
        <button type="button" className="st-button" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="st-debug__toggles">
        <label className="st-check">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Show all strokes
        </label>
        <label className="st-check">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(event) => setShowGrid(event.target.checked)}
          />
          Grid overlay
        </label>
      </div>

      <div
        className="st-debug__canvas-frame"
        style={{ aspectRatio: `${tutorial.canvas.width} / ${tutorial.canvas.height}` }}
      >
        <StrokeCanvas
          className="st-canvas"
          canvas={tutorial.canvas}
          strokeColor={style.strokeColor}
          backgroundColor={style.backgroundColor}
          strokes={strokes}
          // Everything drawn at once, no animation: activeIndex past the end
          // draws them all, before the start draws none.
          activeIndex={showAll ? strokes.length : -1}
          activeProgress={1}
          showPencil={false}
          showGrid={showGrid}
          highlightKey={highlightKey}
          onCursorMove={setCursor}
          title="Static reference render"
        />
      </div>

      <p className="st-debug__cursor">
        cursor{' '}
        <code>
          {cursor
            ? `x ${cursor.x.toFixed(1)}, y ${cursor.y.toFixed(1)}`
            : `— , —  (canvas ${tutorial.canvas.width}×${tutorial.canvas.height})`}
        </code>
      </p>

      <dl className="st-debug__summary">
        <div>
          <dt>Steps</dt>
          <dd>{tutorial.steps.length}</dd>
        </div>
        <div>
          <dt>Strokes</dt>
          <dd>{totalStrokes(tutorial)}</dd>
        </div>
        <div>
          <dt>Total time</dt>
          <dd>{totalDuration(tutorial).toFixed(1)}s</dd>
        </div>
      </dl>

      <div className="st-inspector">
        <h3 className="st-debug__label">Stroke inspector</h3>
        <table className="st-inspector__table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">d</th>
              <th scope="col">dur</th>
              <th scope="col">len</th>
            </tr>
          </thead>
          <tbody>
            {tutorial.steps.map((step, stepIndex) => (
              <StepRows
                key={step.id}
                stepIndex={stepIndex}
                title={step.title}
                rows={rows.filter((row) => row.stepIndex === stepIndex)}
                highlightKey={highlightKey}
                onHighlight={setHighlightKey}
              />
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  )
}

function StepRows({
  stepIndex,
  title,
  rows,
  highlightKey,
  onHighlight,
}: {
  stepIndex: number
  title: string
  rows: InspectorRow[]
  highlightKey: string | null
  onHighlight: (key: string | null) => void
}) {
  return (
    <>
      <tr className="st-inspector__step">
        <th colSpan={4} scope="colgroup">
          {stepIndex + 1}. {title}
        </th>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.key}
          className={`st-inspector__row ${highlightKey === row.key ? 'is-highlighted' : ''}`}
          onMouseEnter={() => onHighlight(row.key)}
          onMouseLeave={() => onHighlight(null)}
        >
          <td className="st-inspector__index">
            {row.stepIndex}.{row.strokeIndex}
          </td>
          <td className="st-inspector__d" title={row.d}>
            {row.d}
          </td>
          <td className="st-inspector__num">{row.duration.toFixed(2)}s</td>
          <td className="st-inspector__num">{Math.round(row.length)}</td>
        </tr>
      ))}
    </>
  )
}
