import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Take, Voice, VoiceInput, VoiceServerStatus, VoiceState } from '../voice/types'

import {
  castVoice,
  createVoice,
  deleteVoice,
  freezeVoice,
  readVoiceState,
  saveVoiceScript,
  sayLine,
  unfreezeVoice,
  updateVoice,
} from './api'
import type { Library } from './library'
import { LessonNarrationPanel } from './voice/LessonNarration'
import { LinaPortrait } from './voice/LinaPortrait'
import { ScriptEditor } from './voice/ScriptEditor'
import { indexTakes, speechKey, takeHash, takeSlot, takesOfVoice } from './voice/takeKey'
import { useAudioPlayer } from './voice/useAudioPlayer'
import { useGenerationQueue } from './voice/useGenerationQueue'
import { VoiceCard, type AuditionLine } from './voice/VoiceCard'
import { VoiceForm } from './voice/VoiceForm'

/** How often the speech server's health is checked while the tab is being looked at. */
const POLL_MS = 20_000

/**
 * Casting Lina (Studio S7): the creator keeps a few candidate voices, hears
 * each of them read the same audition lines, picks one, freezes it so it stops
 * drifting, and narrates lessons with it.
 *
 * Everything here is made on the creator's own machine, on a private
 * text-to-speech server. That server may be asleep, busy or unreachable, so
 * every action on this page says what it is waiting for, and the page keeps
 * working (read-only) when it cannot be reached at all.
 */
export function VoiceView({ library }: { library: Library }) {
  const [state, setState] = useState<VoiceState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tryText, setTryText] = useState('')
  const [adding, setAdding] = useState(false)
  const [hashes, setHashes] = useState<ReadonlyMap<string, string>>(new Map())
  const player = useAudioPlayer()
  const queue = useGenerationQueue()
  const tryTouched = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const next = await readVoiceState()
      setState(next)
      setError(null)
      // The text field starts on the first script line, but never fights the
      // creator for it once they have typed something of their own.
      if (!tryTouched.current) setTryText(next.script[0]?.text ?? '')
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      return null
    }
  }, [])

  useEffect(() => {
    if (!library.writable) return
    void refresh()
  }, [library.writable, refresh])

  // Only the server's health is polled: re-reading everything would snatch a
  // half-typed script line out from under the creator.
  useEffect(() => {
    if (!library.writable) return
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await readVoiceState()
        setState((current) => (current ? { ...current, server: next.server } : next))
      } catch {
        // A failed poll says nothing new; the next action will show the error.
      }
    }
    const onVisible = () => void tick()
    const timer = window.setInterval(onVisible, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [library.writable])

  // Held steady across renders: the hashing effect below keys off them, and a
  // fresh empty array every render would set it spinning.
  const voices = useMemo(() => state?.voices ?? [], [state])
  const script = useMemo(() => state?.script ?? [], [state])

  /* The audition rows every card shows: the bake-off line first, then the script. */
  const lines = useMemo<AuditionLine[]>(() => {
    const rows: AuditionLine[] = script.map((line) => ({ id: line.id, label: line.label, text: line.text }))
    const trimmed = tryText.trim()
    if (trimmed) rows.unshift({ id: '__try', label: 'Try a line', text: trimmed, isTry: true })
    return rows
  }, [script, tryText])

  /*
   * A take belongs to a voice's exact settings as well as its words, so the
   * page hashes each (voice, line) the way the server does before claiming a
   * line is already recorded. A successful "say" overwrites the guess with the
   * hash the server itself used.
   */
  useEffect(() => {
    let current = true
    const build = async () => {
      const next = new Map<string, string>()
      for (const voice of voices) {
        for (const line of lines) next.set(`${voice.id} ${line.text}`, await takeHash(voice, line.text))
      }
      if (!current) return
      setHashes((previous) => {
        const changed = [...next].some(([slot, hash]) => previous.get(slot) !== hash)
        return changed ? new Map([...previous, ...next]) : previous
      })
    }
    void build()
    return () => {
      current = false
    }
  }, [voices, lines])

  const bySlot = useMemo(() => indexTakes(state?.takes ?? []), [state?.takes])
  const takeFor = useCallback(
    (voice: Voice, text: string): Take | null => {
      const hash = hashes.get(`${voice.id} ${text}`)
      return hash ? (bySlot.get(takeSlot(voice.id, hash)) ?? null) : null
    },
    [bySlot, hashes],
  )

  /** Remembers a new recording without re-reading the whole page. */
  const keepTake = (take: Take, text: string) =>
    setState((current) => {
      if (!current) return current
      setHashes((previous) => new Map(previous).set(`${take.voiceId} ${text}`, take.textHash))
      return { ...current, takes: [take, ...current.takes.filter((other) => other.id !== take.id)] }
    })

  const make = useCallback(
    (voice: Voice, text: string, another: boolean) => {
      void queue
        .run(speechKey(voice.id, text), async () => {
          const take = await sayLine(voice.id, text, { another })
          keepTake(take, text)
        })
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
    },
    [queue],
  )

  /** The bake-off: every voice reads the same line, one after another. */
  const hearEveryone = () => {
    const text = tryText.trim()
    if (!text) return
    for (const voice of voices) make(voice, text, false)
  }

  const guard = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      throw caught
    }
  }

  if (!library.writable) {
    return (
      <div className="st-form-page st-form-page--wide st-voice">
        <Title server={null} />
        <p className="st-notice">Casting needs the Studio server. Run npm run dev.</p>
      </div>
    )
  }

  const server = state?.server ?? null
  const unavailable = server && !server.reachable ? (server.error ?? 'The voice server is not answering.') : null

  return (
    <div className="st-form-page st-form-page--wide st-voice">
      <Title server={server} />

      {unavailable ? (
        <p className="st-notice st-voice__down" role="status">
          <strong>The voice server is not answering.</strong>
          <span>
            Nothing can be made until it is back. {unavailable}
          </span>
        </p>
      ) : null}
      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {player.error ? (
        <p className="st-notice st-notice--error" role="alert">
          {player.error}
        </p>
      ) : null}

      {!state ? (
        <p className="st-panel__note">Reading the voices…</p>
      ) : (
        <>
          <section className="st-panel st-voice-try">
            <h2 className="st-label">Try a line</h2>
            <p className="st-field__hint">
              One sentence, every voice, one after another — the quickest way to hear which one is Lina.
            </p>
            <div className="st-voice-try__row">
              <textarea
                className="st-field__input st-voice-try__input"
                rows={2}
                value={tryText}
                aria-label="The line every voice reads"
                placeholder="Type a line for every voice to read…"
                onChange={(event) => {
                  tryTouched.current = true
                  setTryText(event.target.value)
                }}
              />
              <button
                type="button"
                className="st-button st-button--primary"
                disabled={!tryText.trim() || unavailable !== null || voices.length === 0}
                title={unavailable ?? undefined}
                onClick={hearEveryone}
              >
                Hear everyone
              </button>
            </div>
            {queue.progress ? (
              <p className="st-field__hint" role="status">
                Making speech · {queue.progress}. The server takes them one at a time.
              </p>
            ) : null}
          </section>

          <section className="st-voice-cast">
            <h2 className="st-label">The cast</h2>
            {voices.length === 0 ? (
              <p className="st-panel__note">
                No voices yet. Add one below and describe the person you want Lina to be.
              </p>
            ) : null}
            <div className="st-voice-grid">
              {voices.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  cast={state.castVoiceId === voice.id}
                  lines={lines}
                  script={script}
                  takes={takesOfVoice(state.takes, voice.id)}
                  takeFor={takeFor}
                  player={player}
                  queue={queue}
                  unavailable={unavailable}
                  onMake={make}
                  onCast={(target) => guard(() => castVoice(target.id))}
                  onSave={(target, input) => guard(() => updateVoice(target.id, input))}
                  onDuplicate={(target) =>
                    guard(() =>
                      createVoice({
                        name: `${target.name} copy`,
                        tagline: target.tagline,
                        engine: target.engine,
                        instruct: target.instruct,
                        speaker: target.speaker,
                      }),
                    )
                  }
                  onDelete={(target, force) => guard(() => deleteVoice(target.id, { force }))}
                  onFreeze={(target, takeId) => guard(() => freezeVoice(target.id, takeId))}
                  onUnfreeze={(target) => guard(() => unfreezeVoice(target.id))}
                />
              ))}

              <article className="st-voice-card st-voice-card--add">
                {adding ? (
                  <>
                    <h3 className="st-voice-card__name">A new voice</h3>
                    <VoiceForm
                      submitLabel="Add the voice"
                      onCancel={() => setAdding(false)}
                      onSubmit={async (input: VoiceInput) => {
                        await guard(() => createVoice(input))
                        setAdding(false)
                      }}
                    />
                  </>
                ) : (
                  <button type="button" className="st-voice-card__add" onClick={() => setAdding(true)}>
                    <span className="st-voice-card__add-mark" aria-hidden="true">
                      +
                    </span>
                    <span>
                      <strong>Add a voice</strong>
                      <span className="st-field__hint">
                        Describe a person and the server invents her, or pick one of nine speakers.
                      </span>
                    </span>
                  </button>
                )}
              </article>
            </div>
          </section>

          <ScriptEditor
            script={script}
            onSave={async (next) => {
              const result = await saveVoiceScript(next)
              setState((current) => (current ? { ...current, script: result.script } : current))
            }}
          />

          <LessonNarrationPanel
            library={library}
            voices={voices}
            castVoiceId={state.castVoiceId}
            player={player}
            queue={queue}
            unavailable={unavailable}
          />
        </>
      )}
    </div>
  )
}

function Title({ server }: { server: VoiceServerStatus | null }) {
  return (
    <header className="st-voice__head">
      <LinaPortrait size={72} title="Lina, the tutor" />
      <div className="st-voice__titles">
        <h1 className="st-form-page__title">Voice</h1>
        <p className="st-field__hint">
          Cast Lina, then narrate lessons in her voice. Everything is made on your own machine.
        </p>
      </div>
      <ServerPill server={server} />
    </header>
  )
}

/** The speech server in one glance: where it is, whether it is warm, and why not when it is not. */
function ServerPill({ server }: { server: VoiceServerStatus | null }) {
  if (!server) return <span className="st-pill st-voice__server">Checking the voice server…</span>
  if (!server.reachable) {
    return (
      <span
        className="st-pill st-voice__server is-down"
        title={server.error ?? `${server.url} did not answer.`}
        role="status"
      >
        Voice server unreachable
      </span>
    )
  }
  const host = hostOf(server.url)
  if (server.generating) {
    return (
      <span className="st-pill st-voice__server is-busy" title={`${server.url} is making speech.`} role="status">
        Making speech…
      </span>
    )
  }
  // The server names every loaded family (qwen-base, qwen-custom, …); the pill says each once.
  const warm = [...new Set(server.warm.map(prettyModel))].join(', ')
  return (
    <span
      className="st-pill st-voice__server is-up"
      title={`${server.url}${warm ? ` · warm: ${warm}` : ' · nothing loaded yet, the first line will be slow'}`}
      role="status"
    >
      {host}
      {warm ? ` · ${warm} warm` : ' · ready'}
    </span>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    return url
  }
}

/** `chatterbox-turbo` → `Chatterbox`: the family is what matters here, not the build. */
function prettyModel(model: string): string {
  const family = model.split(/[-/]/)[0]
  return family.charAt(0).toUpperCase() + family.slice(1)
}
