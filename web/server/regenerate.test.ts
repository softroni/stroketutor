import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Tutorial } from '../src/schema/types'
import { validateTutorial } from '../src/schema/validate'

import { GenerationFailed, type GenerateDeps } from './generate'
import {
  REGENERATE_OUTPUT_TOKENS,
  applyInstructions,
  applyOrder,
  applySteps,
  regenerate,
  reversePath,
  summariseLesson,
  type PlannedStep,
} from './regenerate'
import { WriteRefused, etagOf, type LibrarySnapshot } from './repoWriter'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString('base64')

const WALLS = 'M 200 400 L 800 400 L 800 900 L 200 900 Z'
const LEFT_ROOF = 'M 150 420 L 500 150'
const RIGHT_ROOF = 'M 500 150 L 850 420'
const DOOR = 'M 450 900 L 450 700 Q 500 650 550 700 L 550 900'

/** Walls, a two-line roof, then a door: s1, s2 + s3, s4. */
function house(): Tutorial {
  return {
    schemaVersion: 1,
    id: 'test-house',
    title: 'Test House',
    canvas: { width: 1000, height: 1000 },
    steps: [
      {
        id: 'walls',
        title: 'Draw the walls',
        instruction: 'Draw the box.',
        voiceover: null,
        strokes: [{ d: WALLS, duration: 3, lineWidth: 14 }],
      },
      {
        id: 'roof',
        title: 'Draw the roof',
        instruction: 'Two lines.',
        voiceover: null,
        strokes: [
          { d: LEFT_ROOF, duration: 1.5, lineWidth: 14 },
          { d: RIGHT_ROOF, duration: 1.5, lineWidth: 12 },
        ],
      },
      {
        id: 'door',
        title: 'Draw the door',
        instruction: 'A door.',
        voiceover: null,
        strokes: [{ d: DOOR, duration: 2, lineWidth: 12 }],
      },
    ],
  }
}

/** The house with its walls coloured in a last, fill-only step (f1). */
function colouredHouse(): Tutorial {
  const tutorial = house()
  return {
    ...tutorial,
    schemaVersion: 2,
    steps: [
      ...tutorial.steps,
      {
        id: 'paint',
        title: 'Colour the walls',
        instruction: 'Colour the walls sand.',
        voiceover: null,
        strokes: [],
        fills: [{ d: WALLS, color: '#E8C872', duration: 1.5, fillRule: 'evenodd' }],
      },
    ],
  }
}

const planned = (id: string, fields: Partial<PlannedStep> = {}): PlannedStep => ({
  id,
  title: '',
  instruction: '',
  strokeIds: [],
  fillIds: [],
  ...fields,
})

const strokesOf = (tutorial: Tutorial) => tutorial.steps.flatMap((step) => step.strokes)

function library(): LibrarySnapshot {
  const text = JSON.stringify(house())
  return {
    tutorials: [{ fileName: 'test-house.json', text, etag: etagOf(text) }],
    paths: null,
    lessons: null,
    references: [],
  }
}

/** A model that always gives `answer`, recording what it was sent. */
function model(answer: unknown) {
  const calls: { body: any }[] = []
  const fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) })
    const payload = {
      model: 'vendor/text-model',
      choices: [{ finish_reason: 'stop', message: { content: typeof answer === 'string' ? answer : JSON.stringify(answer) } }],
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
  layer: 'instructions',
  model: 'vendor/text-model',
  lessonId: 'test-house',
  pathId: null,
  position: 0,
  goal: 'A first house.',
  constraints: '',
  note: 'Say where each line starts.',
  tutorial: house(),
  drawing: { contentType: 'image/png', base64: PNG },
  reference: { contentType: 'image/jpeg', base64: JPEG },
  ...overrides,
})

describe('reversePath', () => {
  it('draws open lines and curves from the other end', () => {
    expect(reversePath(LEFT_ROOF)).toBe('M 500 150 L 150 420')
    expect(reversePath('M 0 0 C 10 0 20 10 30 30')).toBe('M 30 30 C 20 10 10 0 0 0')
    expect(reversePath(DOOR)).toBe('M 550 900 L 550 700 Q 500 650 450 700 L 450 900')
    expect(reversePath(reversePath(DOOR))).toBe(DOOR)
  })

  it('runs a closed shape the other way round from the same start', () => {
    expect(reversePath(WALLS)).toBe('M 200 400 L 200 900 L 800 900 L 800 400 L 200 400 Z')
  })

  it('reverses the order of subpaths too', () => {
    expect(reversePath('M 0 0 L 10 0 M 20 0 L 30 0')).toBe('M 30 0 L 20 0 M 10 0 L 0 0')
  })
})

describe('summariseLesson', () => {
  it('numbers lines and colours in drawing order, with where each one sits', () => {
    const summary = summariseLesson(colouredHouse())
    expect(summary.steps.map((step) => step.strokes.map((stroke) => stroke.id))).toEqual([['s1'], ['s2', 's3'], ['s4'], []])
    const leftRoof = summary.steps[1].strokes[0]
    expect(leftRoof.box).toEqual([150, 150, 500, 420])
    expect(leftRoof.start).toEqual([150, 420])
    expect(leftRoof.end).toEqual([500, 150])
    expect(leftRoof.length).toBeCloseTo(Math.hypot(350, 270))
    expect(summary.steps[3].fills[0]).toMatchObject({ id: 'f1', color: '#E8C872', box: [200, 400, 800, 900], area: 300000 })
  })
})

describe('applyInstructions', () => {
  it('changes the words and nothing else', () => {
    const { tutorial, notes } = applyInstructions(house(), [
      planned('walls', { title: 'Walls first', instruction: 'Start at the top left corner.' }),
      planned('roof', { title: 'The roof', instruction: 'Begin at the ridge.' }),
      planned('chimney', { title: 'A chimney', instruction: 'Made up.' }),
    ])
    expect(tutorial.steps.map((step) => step.title)).toEqual(['Walls first', 'The roof', 'Draw the door'])
    expect(strokesOf(tutorial)).toEqual(strokesOf(house()))
    expect(tutorial.steps.map((step) => step.id)).toEqual(['walls', 'roof', 'door'])
    expect(notes.join(' ')).toContain('1 step keeps its old words')
    expect(notes.join(' ')).toContain('1 step id the model made up was ignored')
  })
})

describe('applyOrder', () => {
  it('reorders steps and lines, reverses lines, and never moves a line to another step', () => {
    const { tutorial, notes } = applyOrder(
      house(),
      [planned('roof', { strokeIds: ['s3', 's2'] }), planned('walls', { strokeIds: ['s1', 's3'] })],
      ['s2', 's9'],
    )
    expect(tutorial.steps.map((step) => step.id)).toEqual(['roof', 'walls', 'door'])
    expect(tutorial.steps[0].strokes.map((stroke) => stroke.d)).toEqual([RIGHT_ROOF, 'M 500 150 L 150 420'])
    // Each stroke keeps its own timing and width, whichever way it is drawn.
    expect(tutorial.steps[0].strokes.map((stroke) => stroke.lineWidth)).toEqual([12, 14])
    expect(tutorial.steps[1].strokes.map((stroke) => stroke.d)).toEqual([WALLS])
    expect(tutorial.steps[0].title).toBe('Draw the roof')
    expect(validateTutorial(tutorial).ok).toBe(true)

    const text = notes.join(' ')
    expect(text).toContain('1 line is now drawn from the other end')
    expect(text).toContain('1 step the model left out was kept at the end')
    expect(text).toContain('2 ids from another step or made up were ignored')
  })

  it('keeps fill-only steps as they are', () => {
    const { tutorial } = applyOrder(colouredHouse(), [planned('paint', { fillIds: ['f1'] })], [])
    expect(tutorial.steps.map((step) => step.id)).toEqual(['paint', 'walls', 'roof', 'door'])
    expect(tutorial.steps[0].fills).toHaveLength(1)
    expect(validateTutorial(tutorial).ok).toBe(true)
  })
})

describe('applySteps', () => {
  it('regroups the same lines into new steps, each placed once', () => {
    const { tutorial, notes } = applySteps(house(), [
      planned('Frame', { title: 'Draw the frame', instruction: 'Walls, then the roof.', strokeIds: ['s1', 's2', 's3'] }),
      planned('door', { title: 'Add the door', instruction: 'Centred on the bottom edge.', strokeIds: ['s4', 's4', 'x1'] }),
    ])
    expect(tutorial.steps.map((step) => step.id)).toEqual(['frame', 'door'])
    expect(strokesOf(tutorial)).toEqual(strokesOf(house()))
    expect(validateTutorial(tutorial).ok).toBe(true)
    expect(notes.join(' ')).toContain('1 id the model made up was ignored')
    expect(notes.join(' ')).toContain('1 repeated id was ignored')
  })

  it('puts lines and colours the model forgot back into the lesson', () => {
    const { tutorial, notes } = applySteps(colouredHouse(), [
      planned('outline', { title: 'Draw the house', instruction: 'Everything but the door.', strokeIds: ['s1', 's2', 's3'] }),
    ])
    expect(tutorial.steps.map((step) => step.id)).toEqual(['outline', 'colour'])
    expect(tutorial.steps[0].strokes).toHaveLength(4)
    expect(tutorial.steps[1]).toMatchObject({ strokes: [], fills: [{ color: '#E8C872' }] })
    expect(validateTutorial(tutorial).ok).toBe(true)
    expect(notes.join(' ')).toContain('1 line the model did not place was added')
    expect(notes.join(' ')).toContain('1 colour the model did not place was put')
  })
})

describe('regenerate', () => {
  it('sends ids, positions and pictures, never path data, and changes only its layer', async () => {
    const router = model({
      rationale: 'Each instruction now says where to start.',
      steps: [
        { id: 'walls', title: 'Walls', instruction: 'Start at the top left.' },
        { id: 'roof', title: 'Roof', instruction: 'Start at the left eave.' },
        { id: 'door', title: 'Door', instruction: 'Centre it on the bottom edge.' },
      ],
    })
    const result = await regenerate(request(), deps(router.fetch))
    expect(result).toMatchObject({
      layer: 'instructions',
      issues: [],
      notes: [],
      rationale: 'Each instruction now says where to start.',
      promptVersion: 'regenerate-instructions-v1',
      model: 'vendor/text-model',
    })
    const tutorial = result.tutorial as Tutorial
    expect(tutorial.steps.map((step) => step.title)).toEqual(['Walls', 'Roof', 'Door'])
    expect(strokesOf(tutorial)).toEqual(strokesOf(house()))

    const body = router.calls[0].body
    expect(body.max_tokens).toBe(REGENERATE_OUTPUT_TOKENS)
    expect(body.response_format.json_schema.name).toBe('stroketutor_instructions')
    const [system, user] = body.messages
    expect(system.content).toContain('Your layer: the words.')
    const text = user.content[0].text
    expect(text).toContain('Step 2, id "roof": Draw the roof')
    expect(text).toContain('s2: 150,150 to 500,420; from 150,420 to 500,150; 442')
    expect(text).toContain('Say where each line starts.')
    expect(text).not.toContain('M 150 420')
    expect(user.content.slice(1).map((part: any) => part.image_url.url)).toEqual([
      `data:image/png;base64,${PNG}`,
      `data:image/jpeg;base64,${JPEG}`,
    ])
  })

  it('regenerates the drawing as a new generation for the same lesson', async () => {
    const fixture = readFileSync(fileURLToPath(new URL('./fixtures/generation-cottage.json', import.meta.url)), 'utf8')
    const router = model(fixture)
    const drawing = { layer: 'drawing', title: 'Test House', image: { contentType: 'image/png', base64: PNG } }
    const result = await regenerate(request(drawing), deps(router.fetch))
    expect(result.layer).toBe('drawing')
    expect(result.issues).toEqual([])
    expect(result.analysis?.mainForms.length).toBeGreaterThan(0)
    expect(result.tutorial).toMatchObject({ id: 'test-house', title: 'Test House' })

    await expect(regenerate(request({ ...drawing, lessonId: 'no-such-lesson' }), deps(router.fetch))).rejects.toMatchObject({
      status: 404,
    })
  })

  it('refuses a bad request before spending anything', async () => {
    const router = model({})
    const bad = [
      request({ layer: 'everything' }),
      request({ tutorial: { ...house(), steps: [] } }),
      request({ lessonId: 'other-house', tutorial: { ...house(), id: 'other-house' } }),
      request({ tutorial: { ...house(), id: 'other-house' } }),
      request({ drawing: undefined }),
    ]
    for (const body of bad) {
      await expect(regenerate(body, deps(router.fetch))).rejects.toBeInstanceOf(WriteRefused)
    }
    expect(router.calls).toHaveLength(0)
  })

  it('fails cleanly when the answer has no steps', async () => {
    const router = model({ rationale: 'Nothing to change.' })
    await expect(regenerate(request({ layer: 'steps' }), deps(router.fetch))).rejects.toBeInstanceOf(GenerationFailed)
  })
})
