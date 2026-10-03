import type { Arrival } from './learners'

/**
 * The Learners page's sounds, made with the Web Audio API so there is no file to load: a
 * light blip for an install, a two-note chime for a free trial, a cash register's bell
 * for a buy. Browsers keep a page quiet until it has been clicked or typed in: `wakeAudio`
 * on a click lets the sounds play later on their own.
 */

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null
  context ??= new AudioContext()
  return context
}

/** Lets later sounds play: call it from a click or a key press. */
export function wakeAudio() {
  const ctx = audio()
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {})
}

/** False until the page has been clicked or typed in, when the browser would play nothing. */
export function audioAllowed(): boolean {
  return navigator.userActivation?.hasBeenActive ?? true
}

/** Plays an arrival's sound now. */
export function playSound(kind: Arrival) {
  const ctx = audio()
  if (!ctx) return
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})
  SOUNDS[kind](ctx, ctx.currentTime + 0.03)
}

/** Each sound, scheduled on `ctx` from `at`. */
export const SOUNDS: Record<Arrival, (ctx: BaseAudioContext, at: number) => void> = {
  // Light: one soft note that slides up a little, gone in a third of a second.
  install(ctx, at) {
    const out = envelope(ctx, at, 0.07, 0.008, 0.3)
    const tone = ctx.createOscillator()
    tone.type = 'sine'
    tone.frequency.setValueAtTime(880, at)
    tone.frequency.exponentialRampToValueAtTime(1175, at + 0.06)
    tone.connect(out)
    tone.start(at)
    tone.stop(at + 0.35)
  },
  // Medium: E5 then B5, each a sine with a faint octave, struck and fading.
  trial(ctx, at) {
    ;[659.25, 987.77].forEach((frequency, index) => {
      const start = at + index * 0.12
      bell(ctx, envelope(ctx, start, 0.16, 0.01, 0.95), start, frequency, [
        [1, 1],
        [2.01, 0.25],
      ])
    })
  },
  // A cash register: the drawer's "ka", then the bell's "ching" struck twice, its
  // overtones out of tune with each other as a real bell's are.
  buy(ctx, at) {
    const click = ctx.createBufferSource()
    const samples = Math.round(ctx.sampleRate * 0.05)
    const noise = ctx.createBuffer(1, samples, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let index = 0; index < samples; index += 1) data[index] = Math.random() * 2 - 1
    click.buffer = noise
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2400
    band.Q.value = 1.2
    click.connect(band).connect(envelope(ctx, at, 0.22, 0.002, 0.05))
    click.start(at)
    const partials: [number, number][] = [
      [1, 1],
      [2.76, 0.45],
      [5.4, 0.2],
      [8.93, 0.08],
    ]
    for (const [delay, frequency, peak] of [
      [0.07, 1318.51, 0.13],
      [0.15, 1760, 0.11],
    ]) {
      bell(ctx, envelope(ctx, at + delay, peak, 0.004, 1.7), at + delay, frequency, partials)
    }
  },
}

/** A gain that rises to `peak` in `rise` seconds from `at`, then fades out over `fall`. */
function envelope(ctx: BaseAudioContext, at: number, peak: number, rise: number, fall: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + rise)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall)
  gain.connect(ctx.destination)
  return gain
}

/** Sines at `frequency` times each ratio, at their levels, into `out`. */
function bell(ctx: BaseAudioContext, out: GainNode, at: number, frequency: number, partials: [number, number][]) {
  for (const [ratio, level] of partials) {
    const tone = ctx.createOscillator()
    const loudness = ctx.createGain()
    tone.type = 'sine'
    tone.frequency.value = frequency * ratio
    // The higher a partial, the sooner it dies away.
    loudness.gain.setValueAtTime(level, at)
    loudness.gain.exponentialRampToValueAtTime(level * 0.001, at + 1.8 / Math.sqrt(ratio))
    tone.connect(loudness).connect(out)
    tone.start(at)
    tone.stop(at + 1.9)
  }
}
