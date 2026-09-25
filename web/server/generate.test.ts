import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { validateTutorial } from '../src/schema/validate'
import { FIXTURE_SHARED } from '../test/fixture'

import { GENERATION_CANVAS, GenerationFailed, generateCandidate, type GenerateDeps } from './generate'
import { lessonContext } from './lessonContext'
import { MAX_OUTPUT_TOKENS, OPENROUTER_URL } from './openrouter'
import { PROMPT_VERSION } from './prompts/lessonPrompt'
import { WriteRefused, etagOf, type LibrarySnapshot } from './repoWriter'

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')

/** The frozen shared/ as the Studio server reads it. */
function snapshot(): LibrarySnapshot {
  const stored = (file: string) => {
    const text = readFileSync(`${FIXTURE_SHARED}${file}`, 'utf8')
    return { text, etag: etagOf(text) }
  }
  return {
    tutorials: readdirSync(`${FIXTURE_SHARED}Tutorials`)
      .filter((name) => name.endsWith('.json'))
      .map((fileName) => ({ fileName, ...stored(`Tutorials/${fileName}`) })),
    paths: stored('Catalog/paths.json'),
    lessons: stored('Catalog/lessons.json'),
    references: [],
  }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')

const request = (overrides: Record<string, unknown> = {}) => ({
  model: 'vendor/vision-model',
  lessonId: 'small-cottage',
  title: 'Small Cottage',
  pathId: 'houses',
  position: 1,
  goal: 'Add character with a chimney and selective details.',
  constraints: 'Under five minutes. Ignore the garden.',
  image: { contentType: 'image/png', base64: PNG },
  ...overrides,
})

interface Call {
  url: string
  init: RequestInit
}

/** A stand-in for OpenRouter that records what it was sent. */
function openRouter(status: number, body: unknown) {
  const calls: Call[] = []
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return { calls, fetch: fake }
}

/** A successful chat completion whose content is `content`. */
const answer = (content: string, finish = 'stop') => ({
  model: 'vendor/vision-model-2026',
  choices: [{ finish_reason: finish, message: { content } }],
  usage: { prompt_tokens: 1200, completion_tokens: 900, cost: 0.012 },
})

function deps(fake: typeof fetch, overrides: Partial<GenerateDeps> = {}): GenerateDeps {
  return {
    apiKey: 'test-key',
    library: async () => snapshot(),
    validateTutorial,
    fetch: fake,
    ...overrides,
  }
}

async function refusal(action: Promise<unknown>) {
  try {
    await action
  } catch (error) {
    if (error instanceof WriteRefused || error instanceof GenerationFailed) return error
    throw error
  }
  throw new Error('Expected a refusal.')
}

describe('generateCandidate', () => {
  it('sends a strict structured-output request with the photo after the text', async () => {
    const router = openRouter(200, answer(fixture('generation-cottage.json')))
    await generateCandidate(request(), deps(router.fetch))

    expect(router.calls).toHaveLength(1)
    const { url, init } = router.calls[0]
    expect(url).toBe(OPENROUTER_URL)
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-key')
    expect(headers['X-OpenRouter-Title']).toBe('Paper Couch Studio')

    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('vendor/vision-model')
    expect(body.max_tokens).toBe(MAX_OUTPUT_TOKENS)
    expect(body.provider).toEqual({ require_parameters: true })
    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema.strict).toBe(true)

    const [system, user] = body.messages
    expect(system.role).toBe('system')
    expect(system.content).toContain('1000 by 1000')
    expect(user.content.map((part: { type: string }) => part.type)).toEqual(['text', 'image_url'])
    expect(user.content[1].image_url.url).toBe(`data:image/png;base64,${PNG}`)
    // The curriculum context and the creator's words reach the model.
    expect(user.content[0].text).toContain('lesson 2 of the "Houses" path')
    expect(user.content[0].text).toContain('"Simple House"')
    expect(user.content[0].text).toContain('Ignore the garden.')
  })

  it('returns a valid candidate, completed and with safe step ids', async () => {
    const router = openRouter(200, answer(fixture('generation-cottage.json')))
    const result = await generateCandidate(request(), deps(router.fetch))

    expect(result.issues).toEqual([])
    expect(result.tutorial).toMatchObject({
      schemaVersion: 1,
      id: 'small-cottage',
      title: 'Small Cottage',
      canvas: GENERATION_CANVAS,
    })
    expect(result.tutorial.steps.map((step) => (step as { id: string }).id)).toEqual([
      'walls',
      'roof',
      'door',
      'windows',
      'chimney',
    ])
    expect(result.analysis.detailsRemoved).toHaveLength(3)
    expect(result).toMatchObject({ model: 'vendor/vision-model-2026', promptVersion: PROMPT_VERSION })
    expect(result.usage).toEqual({ promptTokens: 1200, completionTokens: 900, cost: 0.012 })
  })

  it('reports an out-of-contract candidate by exact path instead of passing it on', async () => {
    const router = openRouter(200, answer(fixture('generation-arc.json')))
    const result = await generateCandidate(request(), deps(router.fetch))
    const paths = result.issues.map((issue) => issue.path)
    expect(paths).toContain('steps[1].strokes[0].duration')
    // Duplicate ids from the model are made unique, not reported.
    expect(result.tutorial.steps.map((step) => (step as { id: string }).id)).toEqual(['window', 'window-2'])
  })

  it('reports the arc command once the schema problems are fixed', async () => {
    const output = JSON.parse(fixture('generation-arc.json'))
    output.tutorial.steps[1].strokes[0].duration = 1
    const router = openRouter(200, answer(JSON.stringify(output)))
    const result = await generateCandidate(request(), deps(router.fetch))
    expect(result.issues.map((issue) => issue.path)).toEqual(['steps[0].strokes[0].d'])
  })

  it('accepts JSON wrapped in a Markdown fence', async () => {
    const router = openRouter(200, answer('```json\n' + fixture('generation-cottage.json') + '\n```'))
    expect((await generateCandidate(request(), deps(router.fetch))).issues).toEqual([])
  })

  it.each([
    ['not JSON', answer('Here is your lesson: a house.'), 502],
    ['no analysis', answer(JSON.stringify({ tutorial: { steps: [] } })), 502],
    ['no steps', answer(JSON.stringify({ ...JSON.parse(fixture('generation-cottage.json')), tutorial: {} })), 502],
    ['a truncated answer', answer(fixture('generation-cottage.json').slice(0, 200), 'length'), 502],
    ['a provider failure inside a 200', { error: { code: 502, message: 'upstream' }, choices: [{ finish_reason: 'error', message: { content: '' } }] }, 502],
    ['an empty answer', answer(''), 502],
  ])('fails cleanly on %s', async (_name, body, status) => {
    const router = openRouter(200, body)
    expect((await refusal(generateCandidate(request(), deps(router.fetch)))).status).toBe(status)
  })

  it.each([
    [401, 401, 'API key'],
    [402, 402, 'credits'],
    [429, 429, 'rate-limiting'],
    [503, 503, 'No provider'],
  ])('explains OpenRouter status %i', async (upstream, status, phrase) => {
    const router = openRouter(upstream, { error: { code: upstream, message: 'nope' } })
    const failure = await refusal(generateCandidate(request(), deps(router.fetch)))
    expect(failure.status).toBe(status)
    expect(failure.message).toContain(phrase)
  })

  it("passes on the provider's own reason, not just \"Provider returned error\"", async () => {
    const error = {
      code: 400,
      message: 'Provider returned error',
      metadata: {
        provider_name: 'Google AI Studio',
        raw: JSON.stringify({ error: { code: 400, message: 'JSON mode is not enabled for this model' } }),
      },
    }
    const refused = await refusal(generateCandidate(request(), deps(openRouter(400, { error }).fetch)))
    expect(refused.status).toBe(400)
    expect(refused.message).toContain('(Google AI Studio: JSON mode is not enabled for this model)')
    expect(refused.message).toContain('Try another model in Settings')

    const inside200 = { error, choices: [{ finish_reason: 'error', message: { content: '' } }] }
    const failed = await refusal(generateCandidate(request(), deps(openRouter(200, inside200).fetch)))
    expect(failed.message).toContain('Google AI Studio: JSON mode is not enabled for this model')
  })

  it('reports the provider and its stop reason when a 200 fails without an error object', async () => {
    const body = {
      provider: 'Google',
      choices: [{ finish_reason: 'error', native_finish_reason: 'MALFORMED_RESPONSE', message: { content: '' } }],
    }
    const failed = await refusal(generateCandidate(request(), deps(openRouter(200, body).fetch)))
    expect(failed.status).toBe(502)
    expect(failed.message).toContain('provider (Google) failed while answering: it stopped with "MALFORMED_RESPONSE"')
  })

  it('checks the input before spending anything', async () => {
    const router = openRouter(200, answer(fixture('generation-cottage.json')))
    const cases: [Record<string, unknown>, Partial<GenerateDeps>, number][] = [
      [{}, { apiKey: undefined }, 503],
      [{ model: '' }, {}, 400],
      [{ lessonId: '../escape' }, {}, 400],
      [{ title: ' ' }, {}, 400],
      [{ goal: '' }, {}, 400],
      [{ image: { contentType: 'image/gif', base64: PNG } }, {}, 415],
      // The browser renders an SVG reference to PNG; the model is never sent SVG.
      [
        {
          image: {
            contentType: 'image/svg+xml',
            base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),
          },
        },
        {},
        415,
      ],
      [{ image: { contentType: 'image/jpeg', base64: PNG } }, {}, 415],
      [{ image: { contentType: 'image/png', base64: '' } }, {}, 400],
      // Never replaces an existing lesson.
      [{ lessonId: 'simple-house' }, {}, 409],
    ]
    for (const [overrides, depOverrides, status] of cases) {
      const failure = await refusal(generateCandidate(request(overrides), deps(router.fetch, depOverrides)))
      expect(failure.status, JSON.stringify(overrides)).toBe(status)
    }
    expect(router.calls).toHaveLength(0)
  })

  it('falls back to the configured default model', async () => {
    const router = openRouter(200, answer(fixture('generation-cottage.json')))
    await generateCandidate(request({ model: '' }), deps(router.fetch, { defaultModel: 'vendor/default' }))
    expect(JSON.parse(String(router.calls[0].init.body)).model).toBe('vendor/default')
  })
})

describe('lessonContext', () => {
  it('lists the lessons before the new one in its path', () => {
    const context = lessonContext(snapshot(), 'houses', 1, 'goal', '')
    expect(context.pathTitle).toBe('Houses')
    expect(context.previous).toEqual([
      expect.objectContaining({ title: 'Simple House', steps: 5, strokes: 6 }),
    ])
  })

  it('clamps the position and tolerates an unknown path', () => {
    expect(lessonContext(snapshot(), 'houses', 99, 'g', '').position).toBe(1)
    expect(lessonContext(snapshot(), 'nowhere', 3, 'g', '')).toMatchObject({ pathTitle: null, previous: [] })
  })
})
