import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PNG_BYTES, fakeBrowser, openTestStudio, squareTrace, type FakeBrowser, type TestStudio } from './testing'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#E8C872"/></svg>'

let t: TestStudio
let bridge: FakeBrowser

beforeEach(async () => {
  bridge = fakeBrowser()
  t = await openTestStudio({ browser: bridge })
})

afterEach(async () => {
  await t.close()
})

describe('lessons render', () => {
  it('writes the finished drawing as SVG with --svg, needing no browser', async () => {
    const out = path.join(t.root, 'house.svg')
    const outcome = await t.studio(['lessons', 'render', 'simple-house', '--svg', '--out', out])
    expect(outcome.stderr).toBe('')
    expect(outcome.code).toBe(0)
    expect(outcome.stdout).toContain(`Wrote ${out}`)
    const svg = await readFile(out, 'utf8')
    expect(svg).toContain('d="M 250 480 L 750 480 L 750 850 L 250 850 Z"')
    expect(svg).toContain('d="M 620 348 L 620 200 L 700 200 L 700 407"')
    expect(bridge.rendered).toHaveLength(0)
  })

  it('writes a contact sheet with a panel per step and captions', async () => {
    const out = path.join(t.root, 'sheet.svg')
    const result = await t.json<{ file: string; panels: number; columns: number; rows: number }>(['lessons', 'render', 'simple-house', '--sheet', '--svg', '--out', out])
    expect(result).toMatchObject({ file: out, panels: 6, columns: 3, rows: 2 })
    const svg = await readFile(out, 'utf8')
    expect(svg.match(/<svg x="/g)).toHaveLength(6)
    expect(svg).toContain('>1 · Draw the walls</text>')
    expect(svg).toContain('>5 · Finish with a chimney</text>')
    expect(svg).toContain('>Finished</text>')
    expect(svg).toContain('>s6</text>')
  })

  it('renders a PNG through the browser by default, at the size asked', async () => {
    const outcome = await t.studio(['lessons', 'render', 'simple-house', '--out', path.join(t.root, 'house.png'), '--size', '512'])
    expect(outcome.code).toBe(0)
    expect(bridge.rendered).toHaveLength(1)
    expect(bridge.rendered[0]).toContain('M 250 480')
    const png = await readFile(path.join(t.root, 'house.png'))
    expect([...png.subarray(0, 8)]).toEqual([...PNG_BYTES.subarray(0, 8)])
  })

  it('refuses a lesson that is not there', async () => {
    const outcome = await t.studio(['lessons', 'render', 'nope', '--svg'])
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('no lesson "nope"')
  })
})

describe('svg preview', () => {
  it('draws a saved trace with its ids, needing no browser', async () => {
    const saved = path.join(t.root, 'trace.json')
    await writeFile(saved, JSON.stringify(squareTrace()))
    const outcome = await t.studio(['svg', 'preview', saved, '--svg'])
    expect(outcome.stderr).toBe('')
    expect(outcome.code).toBe(0)
    const svg = await readFile(path.join(t.root, 'trace.preview.svg'), 'utf8')
    for (const id of ['s1', 's2', 's3', 'f1', 'f2']) expect(svg).toContain(`>${id}</text>`)
    expect(svg).toContain('d="M 100 100 L 300 100" fill="none"')
    expect(bridge.traced).toBe(0)
    expect(bridge.rendered).toHaveLength(0)
  })

  it('traces an SVG through the browser and writes a PNG beside it', async () => {
    const file = path.join(t.root, 'square.svg')
    await writeFile(file, SVG)
    const result = await t.json<{ file: string; lines: number; colours: number; format: string }>(['svg', 'preview', file, '--max-strokes', '32'])
    expect(result).toEqual({ file: path.join(t.root, 'square.preview.png'), bytes: PNG_BYTES.byteLength, format: 'png', lines: 3, colours: 2, only: null, crop: null })
    expect(bridge.traced).toBe(1)
    expect(bridge.rendered).toHaveLength(1)
    expect(bridge.rendered[0]).toContain('>s1</text>')
    const png = await readFile(result.file)
    expect([...png.subarray(0, 8)]).toEqual([...PNG_BYTES.subarray(0, 8)])
  })

  it('zooms into part of the drawing with --crop and labels only --only ids', async () => {
    const saved = path.join(t.root, 'trace.json')
    await writeFile(saved, JSON.stringify(squareTrace()))
    const result = await t.json<{ only: string[]; crop: number[] }>(['svg', 'preview', saved, '--svg', '--only', 's1,s3', '--crop', '50,50,350,350'])
    expect(result.only).toEqual(['s1', 's3'])
    expect(result.crop).toEqual([50, 50, 350, 350])
    const svg = await readFile(path.join(t.root, 'trace.preview.svg'), 'utf8')
    expect(svg).toContain('viewBox="50 50 300 300"')
    expect(svg).toContain('>s1</text>')
    expect(svg).toContain('>s3</text>')
    expect(svg).not.toContain('>s2</text>')
    expect(svg).not.toContain('>f1</text>')

    const unknown = await t.studio(['svg', 'preview', saved, '--svg', '--only', 's9'])
    expect(unknown.code).toBe(1)
    expect(unknown.stderr).toContain('not in the trace: s9')
    const short = await t.studio(['svg', 'preview', saved, '--svg', '--crop', '1,2,3'])
    expect(short.code).toBe(1)
    expect(short.stderr).toContain('four numbers')
    expect((await t.studio(['svg', 'preview', saved, '--svg', '--crop', '10,10,5,20'])).stderr).toContain('x1 > x0')
  })

  it('leaves the labels off with --no-labels, and refuses a JSON file that is not a trace', async () => {
    const saved = path.join(t.root, 'trace.json')
    await writeFile(saved, JSON.stringify(squareTrace()))
    await t.studio(['svg', 'preview', saved, '--svg', '--no-labels'])
    expect(await readFile(path.join(t.root, 'trace.preview.svg'), 'utf8')).not.toContain('<text')
    const other = path.join(t.root, 'plan.json')
    await writeFile(other, JSON.stringify({ outlineSteps: [] }))
    const outcome = await t.studio(['svg', 'preview', other, '--svg'])
    expect(outcome.code).toBe(1)
    expect(outcome.stderr).toContain('is not a trace')
  })
})
