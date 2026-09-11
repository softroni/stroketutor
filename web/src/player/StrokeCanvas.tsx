import { useCallback, useId, useLayoutEffect, useRef } from 'react'

import type { CanvasSpec } from '../schema/types'

/** A stroke ready to draw. `key` identifies it stably across renders. */
export interface RenderStroke {
  key: string
  d: string
  lineWidth: number
  /** v2: this stroke's own colour, ready for SVG. Otherwise the canvas's `strokeColor`. */
  color?: string
}

/** v2: a shape ready to paint. Fills always sit beneath every stroke. */
export interface RenderFill {
  key: string
  d: string
  /** Ready for SVG, leading `#` included. */
  color: string
  fillRule?: 'nonzero' | 'evenodd'
}

export interface CanvasPoint {
  x: number
  y: number
}

export interface StrokeCanvasProps {
  canvas: CanvasSpec
  strokeColor: string
  backgroundColor: string
  /** Strokes from previous steps. Drawn whole, at 0.3 opacity. */
  completed?: RenderStroke[]
  /** Fills from previous steps. Painted whole, at 0.3 opacity. */
  completedFills?: RenderFill[]
  /** Strokes of the current step, drawn strictly in order. */
  strokes: RenderStroke[]
  /** Fills of the current step, painted after its strokes, strictly in order. */
  fills?: RenderFill[]
  /**
   * Position in the current step's timeline: its strokes, then its fills.
   * Anything before it is whole, anything after it is not on screen. Pass
   * `strokes.length + fills.length` to show everything.
   */
  activeIndex: number
  /** 0..1 through the active stroke or fill. */
  activeProgress: number
  showPencil?: boolean
  showGrid?: boolean
  /** `key` of a stroke to pick out — used by the stroke inspector. */
  highlightKey?: string | null
  /** Called with canvas-space coordinates on mouse move, and null on leave. */
  onCursorMove?: (point: CanvasPoint | null) => void
  className?: string
  title?: string
}

const HIGHLIGHT_COLOR = '#D7263D'
const GRID_SPACING = 100
const NO_FILLS: RenderFill[] = []

/**
 * Renders one step of a tutorial into a single `<svg>`.
 *
 * Strokes animate with the dash-offset technique: each path is dashed with its
 * own total length and the offset walks from `length` to `0`, revealing the
 * stroke from its start point to its end. Fills (v2) are revealed left to right
 * through a clip rectangle, like colouring in. Both are set imperatively from
 * an explicit progress value rather than by a CSS transition, so scrubbing and
 * speed changes land on the exact frame they are asked for.
 */
export function StrokeCanvas({
  canvas,
  strokeColor,
  backgroundColor,
  completed = [],
  completedFills = NO_FILLS,
  strokes,
  fills = NO_FILLS,
  activeIndex,
  activeProgress,
  showPencil = true,
  showGrid = false,
  highlightKey = null,
  onCursorMove,
  className,
  title,
}: StrokeCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tipRef = useRef<SVGCircleElement | null>(null)
  const pathElements = useRef(new Map<string, SVGPathElement>())
  const fillElements = useRef(new Map<string, SVGPathElement>())
  const clipRects = useRef(new Map<string, SVGRectElement>())
  // getTotalLength and getBBox are not free, and `d` fully determines both.
  const lengthCache = useRef(new Map<string, number>())
  const boxCache = useRef(new Map<string, DOMRect>())
  // Clip ids must be unique per canvas: the Studio shows many at once.
  const clipPrefix = `st-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const registerPath = useCallback((key: string, element: SVGPathElement | null) => {
    if (element) pathElements.current.set(key, element)
    else pathElements.current.delete(key)
  }, [])

  const registerFill = useCallback((key: string, element: SVGPathElement | null) => {
    if (element) fillElements.current.set(key, element)
    else fillElements.current.delete(key)
  }, [])

  const registerClip = useCallback((key: string, element: SVGRectElement | null) => {
    if (element) clipRects.current.set(key, element)
    else clipRects.current.delete(key)
  }, [])

  const lengthOf = (element: SVGPathElement, d: string): number => {
    const cached = lengthCache.current.get(d)
    if (cached !== undefined) return cached
    const measured = element.getTotalLength()
    lengthCache.current.set(d, measured)
    return measured
  }

  const boxOf = (element: SVGPathElement, d: string): DOMRect => {
    const cached = boxCache.current.get(d)
    if (cached !== undefined) return cached
    const measured = element.getBBox()
    boxCache.current.set(d, measured)
    return measured
  }

  useLayoutEffect(() => {
    const clamped = Math.max(0, Math.min(1, activeProgress))
    const progressAt = (index: number) =>
      index < activeIndex ? 1 : index === activeIndex ? clamped : 0

    strokes.forEach((stroke, index) => {
      const element = pathElements.current.get(stroke.key)
      if (!element) return

      const length = lengthOf(element, stroke.d)
      const progress = progressAt(index)

      if (length === 0) {
        // A degenerate path has nothing to reveal; dashing it would hide it.
        element.style.strokeDasharray = 'none'
        element.style.strokeDashoffset = '0'
      } else {
        element.style.strokeDasharray = `${length} ${length}`
        element.style.strokeDashoffset = `${length * (1 - progress)}`
      }
      // Hidden rather than merely fully-offset: a round linecap can otherwise
      // leave a dot sitting at the start point before the stroke begins.
      element.style.visibility = progress <= 0 ? 'hidden' : 'visible'
    })

    fills.forEach((fill, fillIndex) => {
      const element = fillElements.current.get(fill.key)
      const rect = clipRects.current.get(fill.key)
      if (!element || !rect) return
      const progress = progressAt(strokes.length + fillIndex)
      const box = boxOf(element, fill.d)
      rect.setAttribute('x', String(box.x))
      rect.setAttribute('y', String(box.y))
      rect.setAttribute('height', String(box.height))
      rect.setAttribute('width', String(box.width * progress))
      element.style.visibility = progress <= 0 ? 'hidden' : 'visible'
    })

    const tip = tipRef.current
    if (!tip) return

    // The pencil follows strokes only; fills are revealed without it.
    const active = strokes[activeIndex]
    const activeElement = active ? pathElements.current.get(active.key) : undefined
    if (showPencil && active && activeElement && clamped > 0 && clamped < 1) {
      const length = lengthOf(activeElement, active.d)
      const point = activeElement.getPointAtLength(length * clamped)
      tip.setAttribute('cx', String(point.x))
      tip.setAttribute('cy', String(point.y))
      tip.setAttribute('r', String(active.lineWidth * 0.75))
      tip.setAttribute('fill', active.color ?? strokeColor)
      tip.style.visibility = 'visible'
    } else {
      tip.style.visibility = 'hidden'
    }
  }, [strokes, fills, activeIndex, activeProgress, showPencil, strokeColor])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg || !onCursorMove) return
      const screenToCanvas = svg.getScreenCTM()?.inverse()
      if (!screenToCanvas) return
      // Goes through the CTM so the readout stays correct under
      // preserveAspectRatio letterboxing and any container size.
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(screenToCanvas)
      onCursorMove({ x: point.x, y: point.y })
    },
    [onCursorMove],
  )

  const handleMouseLeave = useCallback(() => onCursorMove?.(null), [onCursorMove])

  const border = Math.max(canvas.width, canvas.height) * 0.003
  const radius = Math.min(canvas.width, canvas.height) * 0.028

  const renderPath = (stroke: RenderStroke, faded: boolean) => {
    const highlighted = highlightKey === stroke.key
    return (
      <path
        key={stroke.key}
        ref={(element) => registerPath(stroke.key, element)}
        d={stroke.d}
        fill="none"
        stroke={highlighted ? HIGHLIGHT_COLOR : (stroke.color ?? strokeColor)}
        strokeWidth={highlighted ? stroke.lineWidth * 1.25 : stroke.lineWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={faded ? 0.3 : 1}
      />
    )
  }

  const renderFill = (fill: RenderFill, faded: boolean, animated: boolean) => {
    const clipId = `${clipPrefix}-${fill.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    return (
      <g key={fill.key} opacity={faded ? 0.3 : 1}>
        {animated ? (
          <clipPath id={clipId}>
            <rect ref={(element) => registerClip(fill.key, element)} x={0} y={0} width={0} height={0} />
          </clipPath>
        ) : null}
        <path
          ref={animated ? (element) => registerFill(fill.key, element) : undefined}
          d={fill.d}
          fill={fill.color}
          fillRule={fill.fillRule ?? 'nonzero'}
          stroke="none"
          clipPath={animated ? `url(#${clipId})` : undefined}
        />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title ?? 'Tutorial drawing'}
      onMouseMove={onCursorMove ? handleMouseMove : undefined}
      onMouseLeave={onCursorMove ? handleMouseLeave : undefined}
    >
      <rect
        x={border / 2}
        y={border / 2}
        width={canvas.width - border}
        height={canvas.height - border}
        rx={radius}
        ry={radius}
        fill={backgroundColor}
        stroke="rgba(43, 43, 43, 0.12)"
        strokeWidth={border}
      />

      {showGrid ? <Grid canvas={canvas} /> : null}

      {/* Fills beneath every stroke, so outlines always stay on top. */}
      <g>{completedFills.map((fill) => renderFill(fill, true, false))}</g>
      <g>{fills.map((fill) => renderFill(fill, false, true))}</g>

      {/* Previous steps: whole, faded, never re-animated. */}
      <g>{completed.map((stroke) => renderPath(stroke, true))}</g>

      {/* Current step. */}
      <g>{strokes.map((stroke) => renderPath(stroke, false))}</g>

      <circle
        ref={tipRef}
        cx={0}
        cy={0}
        r={0}
        fill={strokeColor}
        style={{ visibility: 'hidden' }}
      />
    </svg>
  )
}

/** 100-unit grid in canvas space, with labels along the top and left edges. */
function Grid({ canvas }: { canvas: CanvasSpec }) {
  const unit = Math.max(canvas.width, canvas.height) / 1000
  const lines: React.ReactNode[] = []
  const labels: React.ReactNode[] = []
  const fontSize = 20 * unit

  for (let x = 0; x <= canvas.width; x += GRID_SPACING) {
    const major = x === 0 || x === canvas.width
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={canvas.height}
        stroke="#2B6CB0"
        strokeWidth={(major ? 1.6 : 0.8) * unit}
        opacity={major ? 0.45 : 0.22}
      />,
    )
    if (x > 0 && x < canvas.width) {
      labels.push(
        <text
          key={`vt${x}`}
          x={x + 4 * unit}
          y={fontSize + 2 * unit}
          fontSize={fontSize}
          fill="#2B6CB0"
          opacity={0.7}
        >
          {x}
        </text>,
      )
    }
  }

  for (let y = 0; y <= canvas.height; y += GRID_SPACING) {
    const major = y === 0 || y === canvas.height
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={canvas.width}
        y2={y}
        stroke="#2B6CB0"
        strokeWidth={(major ? 1.6 : 0.8) * unit}
        opacity={major ? 0.45 : 0.22}
      />,
    )
    if (y > 0 && y < canvas.height) {
      labels.push(
        <text
          key={`ht${y}`}
          x={4 * unit}
          y={y - 4 * unit}
          fontSize={fontSize}
          fill="#2B6CB0"
          opacity={0.7}
        >
          {y}
        </text>,
      )
    }
  }

  return (
    <g pointerEvents="none" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
      {lines}
      {labels}
    </g>
  )
}
