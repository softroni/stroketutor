import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { silentWav } from './tts'

/**
 * A stand-in for the creator's speech server, for tests: the same three things
 * the real one does — speak a line, report its health, store a reference
 * through MCP — over a real socket, so `server/tts.ts` is exercised as it is,
 * `fetch` and all.
 *
 * It answers instantly with silence whose length follows the words, so a test
 * can tell one take from another by its duration.
 */

export interface SpeechRequest {
  model: string
  input: string
  instruct?: string
  voice?: string
  ref_audio?: string
  ref_text?: string
}

export interface AddVoiceCall {
  name: string
  transcript: string
  /** The base64 the Studio sent, decoded. */
  audio: Uint8Array
}

export interface FakeTts {
  url: string
  mcpUrl: string
  speech: SpeechRequest[]
  addVoiceCalls: AddVoiceCall[]
  /** The health payload to answer with; a test can change it between calls. */
  health: Record<string, unknown>
  /** When set, every speech request fails with this status and body. */
  failSpeech: { status: number; body: string } | null
  /** When set, `add_voice` answers as an MCP error. */
  failAddVoice: string | null
  close(): Promise<void>
}

/** Roughly how long a line takes to say, so takes differ by their words. */
const durationFor = (text: string) => 400 + text.split(/\s+/).filter(Boolean).length * 320

export async function startFakeTts(): Promise<FakeTts> {
  const fake: FakeTts = {
    url: '',
    mcpUrl: '',
    speech: [],
    addVoiceCalls: [],
    health: {
      mlx_server: 'up',
      warm_models: ['chatterbox-turbo'],
      generating: false,
      public_url: 'http://fake.invalid',
      voices: ['test-reference'],
    },
    failSpeech: null,
    failAddVoice: null,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      const path = (req.url ?? '/').split('?')[0]

      if (path === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(fake.health))
        return
      }

      if (path === '/v1/audio/speech') {
        if (fake.failSpeech) {
          res.writeHead(fake.failSpeech.status, { 'content-type': 'text/plain' })
          res.end(fake.failSpeech.body)
          return
        }
        const request = JSON.parse(body) as SpeechRequest
        fake.speech.push(request)
        const wav = silentWav(durationFor(request.input))
        res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': String(wav.byteLength) })
        res.end(Buffer.from(wav))
        return
      }

      if (path === '/mcp') {
        const message = JSON.parse(body) as { id?: number; method?: string; params?: { name?: string; arguments?: Record<string, string> } }
        if (message.method === 'notifications/initialized') {
          res.writeHead(202)
          res.end()
          return
        }
        if (message.method === 'tools/call' && message.params?.name === 'add_voice') {
          const args = message.params.arguments ?? {}
          const audio = new Uint8Array(Buffer.from(args.audio_base64 ?? '', 'base64'))
          fake.addVoiceCalls.push({ name: args.name ?? '', transcript: args.transcript ?? '', audio })
          const content = fake.failAddVoice
            ? { content: [{ type: 'text', text: fake.failAddVoice }], isError: true }
            : {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ name: args.name, bytes: audio.byteLength, duration_seconds: 7.04 }),
                  },
                ],
                isError: false,
              }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: content }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-03-26' } }))
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: `no route ${path}` }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  fake.url = `http://127.0.0.1:${port}`
  fake.mcpUrl = `${fake.url}/mcp`
  return fake
}

/** A converter for tests: m4a is a real encoder's job, so stand in for it and record the calls. */
export function fakeConverter(): { convert: (wav: Uint8Array) => Promise<Uint8Array>; calls: Uint8Array[] } {
  const calls: Uint8Array[] = []
  return {
    calls,
    async convert(wav) {
      calls.push(wav)
      // Enough of an MPEG-4 header that a test can tell it is not the WAV.
      const header = Buffer.from('00000020667479704D344120', 'hex')
      return new Uint8Array(Buffer.concat([header, Buffer.from(wav.slice(0, 32))]))
    },
  }
}
