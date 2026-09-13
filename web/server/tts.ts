import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { QWEN_SPEAKERS, type FrozenReference, type VoiceEngine, type VoiceServerStatus } from '../src/voice/types'

import { WriteRefused } from './repoWriter'

/**
 * The client for the creator's own text-to-speech server: an MLX-Audio server
 * on their tailnet, reached over plain HTTP/1.1, with no key and nothing sent
 * to an outside provider. Lina's voice is made on that machine and nowhere
 * else.
 *
 * Three things happen here and nowhere else in the Studio:
 * - **Speech**: `POST {url}/v1/audio/speech`, OpenAI-compatible, answering with
 *   the audio itself (RIFF/WAV, 24 kHz mono 16-bit). Which JSON body to send
 *   depends on the engine, and `speechBody` is the only place that knows.
 * - **Health**: `GET {mcp origin}/health`, on a short leash, because the page
 *   asks every twenty seconds and a sleeping Mac must not hang the Studio.
 * - **Freezing**: uploading a take as a reference voice through the server's
 *   MCP endpoint (`add_voice`), plain JSON-RPC over HTTP, no session to keep.
 *
 * Everything the server refuses is reported with the server's own words, so a
 * wrong model path or a missing reference reads as what it is.
 */

/** Where the models live on the creator's Mac. The server takes a path, not a name. */
const MODELS = {
  chatterbox: '/Users/kevin/tts/models/chatterbox-turbo',
  'qwen-design': '/Users/kevin/tts/models/qwen-design',
  'qwen-custom': '/Users/kevin/tts/models/qwen-custom',
  /** A frozen voice is cloned from its reference by the base model, whatever it was designed with. */
  frozen: '/Users/kevin/tts/models/qwen-base',
} as const

/** Where `add_voice` puts an uploaded reference, and where a clone reads it from. */
const REFERENCE_DIR = '/Users/kevin/tts/voices'

/**
 * Making speech is slow and serialised on the server: one line at a time, and
 * the first after a model-family switch waits for weights to load. Ten minutes
 * is longer than any line could need and short enough to end a hung request.
 */
export const SPEECH_TIMEOUT_MS = 10 * 60 * 1000

/** The status pill must never be what makes the page feel slow. */
export const HEALTH_TIMEOUT_MS = 3000

/** Everything the Studio needs to talk to the speech server. */
export interface TtsDeps {
  /** The speech endpoint's origin, from `STUDIO_TTS_URL`. */
  url: string
  /** The MCP endpoint, from `STUDIO_TTS_MCP_URL`. Health lives at its origin. */
  mcpUrl: string
  /** Injected so tests can answer without a server. */
  fetch?: typeof fetch
  /** WAV to AAC-in-m4a. Injected so tests need no `afconvert`. */
  convert?: (wav: Uint8Array) => Promise<Uint8Array>
}

/** The part of a voice that decides how it sounds; the rest is bookkeeping. */
export interface VoiceSettings {
  engine: VoiceEngine
  instruct: string
  speaker: string | null
  frozen: FrozenReference | null
}

/**
 * The JSON body for one line, per engine. A frozen voice ignores its engine
 * and clones its reference instead, which is the whole point of freezing: the
 * voice stops drifting from take to take.
 */
export function speechBody(voice: VoiceSettings, text: string): Record<string, unknown> {
  if (voice.frozen) {
    return {
      model: MODELS.frozen,
      input: text,
      ref_audio: `${REFERENCE_DIR}/${voice.frozen.referenceName}.wav`,
      ref_text: voice.frozen.referenceText,
      lang_code: 'English',
      response_format: 'wav',
    }
  }
  if (voice.engine === 'chatterbox') {
    return { model: MODELS.chatterbox, input: text, response_format: 'wav', lang_code: 'en' }
  }
  if (voice.engine === 'qwen-design') {
    return {
      model: MODELS['qwen-design'],
      input: text,
      instruct: voice.instruct,
      lang_code: 'English',
      response_format: 'wav',
    }
  }
  // An unknown speaker does not fail on the server, it quietly falls back to
  // another one, so the mistake would only show up as a voice that is not the
  // one that was cast. Refuse it here instead.
  if (!voice.speaker || !(QWEN_SPEAKERS as readonly string[]).includes(voice.speaker)) {
    throw new WriteRefused(422, `"${voice.speaker ?? ''}" is not a CustomVoice speaker: pick one of ${QWEN_SPEAKERS.join(', ')}.`)
  }
  return {
    model: MODELS['qwen-custom'],
    input: text,
    voice: voice.speaker,
    instruct: voice.instruct,
    lang_code: 'English',
    response_format: 'wav',
  }
}

/** One line, spoken. The bytes are a WAV, which is what the workspace keeps. */
export async function speak(voice: VoiceSettings, text: string, deps: TtsDeps): Promise<Uint8Array> {
  const spoken = text.trim()
  if (!spoken) throw new WriteRefused(422, 'There is nothing to say: the text is empty.')
  const endpoint = `${trimSlash(deps.url)}/v1/audio/speech`
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(speechBody(voice, spoken)),
    timeoutMs: SPEECH_TIMEOUT_MS,
    fetcher: deps.fetch,
    what: 'make speech',
    url: deps.url,
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (wavDurationMs(bytes) === null) {
    throw new WriteRefused(502, `The voice server at ${deps.url} answered with something that is not a WAV file.`)
  }
  return bytes
}

/**
 * What the speech server is doing right now. This never throws: the Voice page
 * polls it, and a Mac that is asleep is a thing to say, not an error to handle.
 */
export async function probe(deps: TtsDeps): Promise<VoiceServerStatus> {
  const unknown = { url: deps.url, reachable: false, warm: [], generating: false, references: [] }
  let payload: {
    mlx_server?: string
    warm_models?: unknown
    generating?: unknown
    voices?: unknown
  } | null
  try {
    const response = await request(`${origin(deps.mcpUrl)}/health`, {
      method: 'GET',
      timeoutMs: HEALTH_TIMEOUT_MS,
      fetcher: deps.fetch,
      what: 'read the health of',
      url: deps.url,
    })
    payload = (await response.json()) as typeof payload
  } catch (error) {
    return { ...unknown, error: error instanceof Error ? error.message : String(error) }
  }
  const warm = strings(payload?.warm_models)
  const references = strings(payload?.voices)
  if (payload?.mlx_server !== 'up') {
    return {
      ...unknown,
      warm,
      references,
      error: `The voice server at ${deps.url} is answering, but its speech engine is ${payload?.mlx_server ?? 'not running'}.`,
    }
  }
  return { url: deps.url, reachable: true, warm, generating: payload.generating === true, references }
}

/** What `add_voice` reports back about a stored reference. */
export interface StoredReference {
  name: string
  bytes: number
  durationSeconds: number | null
}

/**
 * Uploads a take as a reference voice, so later lines can be cloned from it.
 * The server exposes this as an MCP tool rather than a REST endpoint, and its
 * MCP transport is stateless: initialize, say so, call. No session id is kept
 * between the three, which is why they can be three plain POSTs.
 */
export async function addReference(
  name: string,
  transcript: string,
  wav: Uint8Array,
  deps: TtsDeps,
): Promise<StoredReference> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new WriteRefused(400, `"${name}" is not a reference name: use lowercase letters, digits and single dashes.`)
  }
  await rpc(deps, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'stroketutor-studio', version: '1' },
    },
  })
  await rpc(deps, { jsonrpc: '2.0', method: 'notifications/initialized' })
  const result = await rpc(deps, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'add_voice',
      arguments: { name, transcript, audio_base64: Buffer.from(wav).toString('base64') },
    },
  })

  const call = (result?.result ?? {}) as { content?: { type?: string; text?: string }[]; isError?: boolean }
  const text = call.content?.find((part) => part.type === 'text')?.text ?? ''
  if (call.isError) {
    throw new WriteRefused(502, `The voice server at ${deps.url} could not store the reference: ${text || 'no reason given'}`)
  }
  const stored = parseJSON(text) as { name?: unknown; bytes?: unknown; duration_seconds?: unknown } | null
  return {
    name: typeof stored?.name === 'string' ? stored.name : name,
    bytes: typeof stored?.bytes === 'number' ? stored.bytes : wav.byteLength,
    durationSeconds: typeof stored?.duration_seconds === 'number' ? stored.duration_seconds : null,
  }
}

/**
 * How long a WAV plays, from its own header: the format chunk says how many
 * bytes a second the data is, and the data chunk says how many there are.
 * Reading four numbers is cheaper and more honest than shelling out to a tool
 * that may not be installed.
 *
 * Returns null for anything that is not a PCM WAV we can measure.
 */
export function wavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 44) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null

  let channels = 0
  let sampleRate = 0
  let bitsPerSample = 0
  let dataBytes = 0

  // Chunks run end to end after the 12-byte header, each padded to an even length.
  for (let at = 12; at + 8 <= bytes.byteLength; ) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    const available = bytes.byteLength - body
    if (id === 'fmt ' && size >= 16 && available >= 16) {
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
    } else if (id === 'data') {
      // A file written while it was still being recorded can claim a length it
      // does not have; what is there is the truth.
      dataBytes = size === 0 || size > available ? available : size
      break
    }
    at = body + size + (size % 2)
    if (size === 0) break
  }

  const bytesPerSecond = sampleRate * channels * Math.ceil(bitsPerSample / 8)
  if (!bytesPerSecond || !dataBytes) return null
  return Math.round((dataBytes / bytesPerSecond) * 1000)
}

/** A silent WAV of `ms` at 24 kHz mono 16-bit: what the speech server answers with, without a server. */
export function silentWav(ms: number, sampleRate = 24000): Uint8Array {
  const samples = Math.max(0, Math.round((ms / 1000) * sampleRate))
  const dataBytes = samples * 2
  const bytes = new Uint8Array(44 + dataBytes)
  const view = new DataView(bytes.buffer)
  const tag = (at: number, text: string) => {
    for (let index = 0; index < 4; index += 1) bytes[at + index] = text.charCodeAt(index)
  }
  tag(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // bytes a second
  view.setUint16(32, 2, true) // bytes a frame
  view.setUint16(34, 16, true)
  tag(36, 'data')
  view.setUint32(40, dataBytes, true)
  return bytes
}

const run = promisify(execFile)

/** The converters, in the order they are tried: Apple's own first, since the Studio runs on macOS. */
const CONVERTERS: { command: string; args: (input: string, output: string) => string[] }[] = [
  { command: 'afconvert', args: (input, output) => ['-f', 'm4af', '-d', 'aac', '-b', '48000', input, output] },
  { command: 'ffmpeg', args: (input, output) => ['-y', '-i', input, '-c:a', 'aac', '-b:a', '48k', '-ac', '1', output] },
]

/**
 * A published line is AAC in an m4a container at 48 kbps mono, which is what
 * the handbook's voice pipeline specifies and what `NarrationPlayer` opens.
 * The workspace keeps WAV, so this runs only on publish, and only ever on
 * files the Studio wrote itself into a temporary directory.
 */
export async function convertToM4a(wav: Uint8Array): Promise<Uint8Array> {
  const folder = await mkdtemp(path.join(tmpdir(), 'stroketutor-voice-'))
  const input = path.join(folder, 'line.wav')
  const output = path.join(folder, 'line.m4a')
  try {
    await writeFile(input, wav)
    const failures: string[] = []
    for (const converter of CONVERTERS) {
      try {
        await run(converter.command, converter.args(input, output))
        return new Uint8Array(await readFile(output))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        failures.push(`${converter.command}: ${describe(error)}`)
      }
    }
    if (failures.length > 0) {
      throw new WriteRefused(500, `The audio could not be converted to AAC. ${failures.join('; ')}`)
    }
    throw new WriteRefused(
      500,
      'Publishing a voice needs afconvert (part of macOS) or ffmpeg to make AAC files, and neither is installed.',
    )
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

// ---------- The plumbing ----------

/** One JSON-RPC call to the MCP endpoint, with the answer parsed however it arrives. */
async function rpc(deps: TtsDeps, body: unknown): Promise<{ result?: unknown; error?: { message?: string } } | null> {
  const response = await request(deps.mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
    // Storing a reference re-encodes the audio on the server; it is not instant.
    timeoutMs: SPEECH_TIMEOUT_MS,
    fetcher: deps.fetch,
    what: 'store a reference voice on',
    url: deps.url,
  })
  const text = await response.text()
  if (!text.trim()) return null
  // A notification answers 202 with nothing; a call may answer as an event
  // stream, whose payload is the last `data:` line.
  const payload = parseJSON(text.includes('data:') ? lastDataLine(text) : text) as {
    result?: unknown
    error?: { message?: string }
  } | null
  if (payload?.error) {
    throw new WriteRefused(502, `The voice server at ${deps.url} refused: ${payload.error.message ?? 'no reason given'}`)
  }
  return payload
}

interface RequestOptions {
  method: string
  headers?: Record<string, string>
  body?: string
  timeoutMs: number
  fetcher?: typeof fetch
  /** Fills "Could not <what> the voice server at …". */
  what: string
  /** The speech origin, which is the one the creator recognises. */
  url: string
}

/**
 * One request with a deadline, whose failures all read the same way. Node's
 * `fetch` speaks HTTP/1.1, which is what this server wants.
 */
async function request(endpoint: string, options: RequestOptions): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(endpoint, {
      method: options.method,
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: controller.signal,
    })
  } catch (error) {
    throw new WriteRefused(
      502,
      controller.signal.aborted
        ? `The voice server at ${options.url} took longer than ${Math.round(options.timeoutMs / 1000)}s to answer, so the request was stopped.`
        : `Could not ${options.what} the voice server at ${options.url}. Is the Mac awake and on the tailnet? (${describe(error)})`,
    )
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim().slice(0, 500)
    throw new WriteRefused(
      502,
      `The voice server at ${options.url} answered ${response.status}${detail ? `: ${detail}` : '.'}`,
    )
  }
  return response
}

function lastDataLine(text: string): string {
  const lines = text.split('\n').filter((line) => line.startsWith('data:'))
  return lines.length > 0 ? lines[lines.length - 1].slice(5).trim() : text
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Health lives beside the MCP endpoint, not under it: `https://host:8443/mcp` → `https://host:8443`. */
function origin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return trimSlash(url)
  }
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const cause = (error as { cause?: { message?: string } } | null)?.cause?.message
  return cause && !message.includes(cause) ? `${message}: ${cause}` : message
}
