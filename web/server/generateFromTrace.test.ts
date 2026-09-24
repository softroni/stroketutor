import { describe, expect, it } from 'vitest'

import { validateTutorial } from '../src/schema/validate'

import { GenerationFailed, type GenerateDeps } from './generate'
import { fillDuration, generateFromTrace, strokeDuration } from './generateFromTrace'
import { WriteRefused, type LibrarySnapshot } from './repoWriter'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')
const library = (): LibrarySnapshot => ({ tutorials: [], paths: null, lessons: null, references: [] })

const line = (id: string, d: string, length: number) => ({
  id,
  d,
  lineWidth: 6,
  length,
  box: [100, 100, 300, 300],
  closed: false,
})

/** A traced square: three lines, a colour and a smaller colour inside it. */
const trace = () => ({
  canvas: { width: 1000, height: 1000 },
  strokes: [
    line('s1', 'M 100 100 L 300 100', 200),
    line('s2', 'M 100 100 L 100 300', 200),
    line('s3', 'M 300 100 L 300 300', 200),
  ],
  fills: [
    { id: 'f1', d: 'M 100 100 L 300 100 L 300 300 L 100 300 Z', color: '#E8C872', area: 40000, box: [100, 100, 300, 300] },
    { id: 'f2', d: 'M 150 150 L 250 150 L 250 250 L 150 250 Z', color: '#1F3A5F', area: 10000, box: [150, 150, 250, 250] },
  ],
})

const analysis = { mainForms: ['a square'], importantDetails: [], detailsRemoved: [], drawingStrategy: 'The top edge first.' }
const step = (id: string, ids: string[], key: 'strokeIds' | 'fillIds' = 'strokeIds') => ({
  id,
  title: `Draw the ${id}`,
  instruction: `Draw the ${id}, as the animation shows.`,
  [key]: ids,
})

/** A model that always gives `answer`, recording what it was sent. */
function model(answer: unknown) {
  const calls: { body: any }[] = []
  const fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) })
    const payload = {
      model: 'vendor/text-model',
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }],
      usage: { prompt_tokens: 900, completion_tokens: 400, cost: 0.004 },
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  return { calls, fetch }
}

const deps = (fetch: typeof globalThis.fetch): GenerateDeps => ({
  apiKey: 'test-key',
  library: async () => library(),
  validateTutorial,
  fetch,
})

const request = (overrides: Record<string, unknown> = {}) => ({
  model: 'vendor/text-model',
  lessonId: 'traced-square',
  title: 'Square',
  goal: 'Draw a square and colour it.',
  constraints: '',
  pathId: null,
  position: 0,
  image: { contentType: 'image/png', base64: PNG },
  trace: trace(),
  ...overrides,
})

describe('generateFromTrace', () => {
  it('builds a v2 lesson from the traced shapes, in the model’s order, colours last', async () => {
    const router = model({
      analysis,
      outlineSteps: [step('top', ['s1']), step('sides', ['s2', 's3'])],
      colourSteps: [step('square', ['f1'], 'fillIds'), step('middle', ['f2'], 'fillIds')],
    })
    const result = await generateFromTrace(request(), deps(router.fetch))
    expect(result.issues).toEqual([])
    expect(result.notes).toEqual([])
    expect(result.promptVersion).toBe('svg-lesson-v1')

    const tutorial = result.tutorial as any
    expect(tutorial.schemaVersion).toBe(2)
    expect(tutorial.steps.map((s: any) => s.id)).toEqual(['top', 'sides', 'square', 'middle'])
    expect(tutorial.steps[0].strokes[0]).toEqual({ d: 'M 100 100 L 300 100', duration: strokeDuration(200), lineWidth: 6 })
    expect(tutorial.steps[1].strokes.map((s: any) => s.d)).toEqual(['M 100 100 L 100 300', 'M 300 100 L 300 300'])
    expect(tutorial.steps[2]).toMatchObject({
      strokes: [],
      fills: [{ color: '#E8C872', duration: fillDuration(40000), fillRule: 'evenodd' }],
    })

    // The model saw positions and sizes, never path data, and then the picture.
    const body = router.calls[0].body
    expect(body.response_format.json_schema.name).toBe('papercoach_svg_lesson')
    const user = body.messages[1]
    expect(user.content[0].text).toContain('s2: 100,100 to 300,300; 200; open')
    expect(user.content[0].text).toContain('f1: #E8C872')
    expect(user.content[0].text).not.toContain('M 100 100')
    expect(user.content[1].image_url.url).toBe(`data:image/png;base64,${PNG}`)
  })

  it('places every line and colour exactly once, whatever the model returns', async () => {
    const router = model({
      analysis,
      outlineSteps: [step('top', ['s1', 's1', 'x9']), step('empty', ['nope'])],
      colourSteps: [],
    })
    const result = await generateFromTrace(request(), deps(router.fetch))
    expect(result.issues).toEqual([])
    const tutorial = result.tutorial as any
    expect(tutorial.steps.map((s: any) => s.id)).toEqual(['top', 'colour'])
    expect(tutorial.steps[0].strokes.map((s: any) => s.d)).toEqual([
      'M 100 100 L 300 100',
      'M 100 100 L 100 300',
      'M 300 100 L 300 300',
    ])
    expect(tutorial.steps[1].fills).toHaveLength(2)
    const notes = result.notes.join(' ')
    expect(notes).toContain('2 lines the model did not place were added')
    expect(notes).toContain('2 colours the model did not place were put')
    expect(notes).toContain('2 ids the model made up were ignored')
    expect(notes).toContain('1 repeated id was ignored')
  })

  it('stays version 1 when the drawing has no colour, so every player can read it', async () => {
    const router = model({ analysis, outlineSteps: [step('square', ['s1', 's2', 's3'])], colourSteps: [] })
    const result = await generateFromTrace(request({ trace: { ...trace(), fills: [] } }), deps(router.fetch))
    expect((result.tutorial as any).schemaVersion).toBe(1)
    expect(result.issues).toEqual([])
  })

  it('refuses a malformed trace before spending anything', async () => {
    const router = model({})
    const malformed = [
      undefined,
      { ...trace(), strokes: [{ id: 's1' }] },
      { ...trace(), strokes: [line('s1', 'M 0 0 L 9 9', 13), line('s1', 'M 0 0 L 9 9', 13)] },
      { ...trace(), strokes: [], fills: [] },
    ]
    for (const bad of malformed) {
      await expect(generateFromTrace(request({ trace: bad }), deps(router.fetch))).rejects.toBeInstanceOf(WriteRefused)
    }
    expect(router.calls).toHaveLength(0)
  })

  it('fails cleanly when the model leaves out the colour steps', async () => {
    const router = model({ analysis, outlineSteps: [step('top', ['s1'])] })
    await expect(generateFromTrace(request(), deps(router.fetch))).rejects.toBeInstanceOf(GenerationFailed)
  })
})
