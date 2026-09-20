import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { TutorialPlayerProps } from '../../player/TutorialPlayer'
import { INTRO_ID, OUTRO_ID } from '../../voice/bookends'

import type { LessonNarration, StepNarration } from '../../voice/types'
import { narrateStep, readLessonNarration, saveNarrationLine } from '../api'
import { routeHref } from '../route'

import { useAudioPlayer } from './useAudioPlayer'

const SPEAK_KEY = 'stroketutor.studio.preview.speak'

/**
 * Lina in the lesson's Preview: each step is spoken as the learner would hear
 * it, and a step with no recording, or an out-of-date one, can be recorded
 * where it is noticed. Casting, spoken lines and publishing stay on the Voice
 * page; this is for hearing a lesson while looking at it.
 *
 * `onStep` is handed to the player, and `controls` goes in its instruction card.
 */
export function usePreviewVoice(
  lessonId: string,
  saved: boolean,
): {
  onStep: (stepId: string, run: number) => void
  controls: ReactNode
  lina: TutorialPlayerProps['lina']
  /** Listen and record for one step, for the step's card in the Steps pane. */
  stepVoice: (stepId: string) => ReactNode
  /** What Lina says before or after the lesson, as a card for the Steps pane: the words, listen, record. */
  bookend: (kind: 'intro' | 'outro') => ReactNode
} {
  const player = useAudioPlayer()
  const [narration, setNarration] = useState<LessonNarration | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const [recording, setRecording] = useState<'step' | 'all' | null>(null)
  /** The words being rewritten for the part on screen, or null when they are not being edited. */
  const [draft, setDraft] = useState<string | null>(null)
  const [speak, setSpeak] = useState(() => {
    try {
      return localStorage.getItem(SPEAK_KEY) !== '0'
    } catch {
      return true
    }
  })

  // Read again once an edit is saved: changed words make a recording out of date.
  useEffect(() => {
    if (!saved) return
    let current = true
    readLessonNarration(lessonId)
      .then((next) => current && (setNarration(next), setProblem(null)))
      .catch((caught: unknown) => current && setProblem(caught instanceof Error ? caught.message : 'The voice could not be read.'))
    return () => {
      current = false
    }
  }, [lessonId, saved])

  const step = narration?.steps.find((candidate) => candidate.stepId === stepId) ?? null
  const takeId = step?.take?.id ?? null

  // Speak a step when it is arrived at, not each time its recording is looked up again.
  const spoken = useRef<string | null>(null)
  const { play, stop } = player
  useEffect(() => {
    if (!speak || !stepId || !takeId) return
    const key = `${stepId}:${takeId}:${run}`
    if (spoken.current === key) return
    spoken.current = key
    play(takeId)
  }, [play, run, speak, stepId, takeId])

  const onStep = useCallback(
    (next: string, nextRun: number) => {
      stop()
      setDraft(null)
      setStepId(next)
      setRun(nextRun)
    },
    [stop],
  )

  const record = async (which: 'step' | 'all') => {
    if (!narration || !stepId) return
    const ids = which === 'step' ? [stepId] : narration.steps.filter((candidate) => candidate.stale !== null).map((candidate) => candidate.stepId)
    setRecording(which)
    setProblem(null)
    try {
      for (const id of ids) setNarration(await narrateStep(lessonId, id, { another: which === 'step' && step?.stale === null }))
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'The recording failed.')
    } finally {
      setRecording(null)
    }
  }

  // Saves what Lina says here, and records it straight away so it can be heard. Empty words go back
  // to the usual ones: the step's instruction, or the pattern for the start or end of a lesson.
  const saveWords = async () => {
    if (draft === null || !step) return
    const words = draft.trim()
    setRecording('step')
    setProblem(null)
    try {
      setNarration(await saveNarrationLine(lessonId, step.stepId, words && words !== step.instruction ? words : null))
      setNarration(await narrateStep(lessonId, step.stepId))
      setDraft(null)
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'The words could not be saved.')
    } finally {
      setRecording(null)
    }
  }

  const waiting = narration?.steps.filter((candidate) => candidate.stale !== null).length ?? 0
  let controls: ReactNode = null
  if (problem && !narration) {
    controls = <p className="st-preview-voice__note">Voice: {problem}</p>
  } else if (narration && !narration.castVoiceId) {
    controls = (
      <p className="st-preview-voice__note">
        No voice is cast as Lina yet. <a href={routeHref({ name: 'voice' })}>Cast one on the Voice page</a>.
      </p>
    )
  } else if (narration && step) {
    const playing = takeId !== null && player.playingTakeId === takeId
    controls = (
      <div className="st-preview-voice" role="group" aria-label="Lina’s voice for this step">
        {takeId ? (
          <button type="button" className="st-button" onClick={() => player.toggle(takeId)} title={step.text}>
            {playing ? '■ Stop' : '🔊 Listen'}
          </button>
        ) : null}
        <button type="button" className="st-button" disabled={recording !== null || !saved} onClick={() => void record('step')}>
          {recording === 'step' ? 'Recording…' : step.take ? (step.stale ? 'Record again' : 'Another take') : step.kind === 'step' ? 'Record this step' : 'Record this'}
        </button>
        {waiting > 1 || (waiting === 1 && step.stale === null) ? (
          <button type="button" className="st-button" disabled={recording !== null || !saved} onClick={() => void record('all')}>
            {recording === 'all' ? 'Recording…' : `Record the ${waiting} that need it`}
          </button>
        ) : null}
        <button type="button" className="st-button" disabled={recording !== null} onClick={() => setDraft(draft === null ? step.text : null)}>
          {draft === null ? 'Change what Lina says' : 'Cancel'}
        </button>
        <label className="st-preview-voice__speak">
          <input
            type="checkbox"
            checked={speak}
            onChange={(event) => {
              setSpeak(event.target.checked)
              if (!event.target.checked) stop()
              try {
                localStorage.setItem(SPEAK_KEY, event.target.checked ? '1' : '0')
              } catch {
                // Private browsing: the choice lasts for this visit.
              }
            }}
          />
          Speak each step
        </label>
        <span className="st-preview-voice__note">
          {step.stale === 'missing'
            ? 'Not recorded yet.'
            : step.stale === 'text-changed'
              ? 'The words changed since this was recorded.'
              : step.stale === 'voice-changed'
                ? 'Recorded in another voice.'
                : step.spokenLine && step.kind === 'step'
                  ? 'Speaks its own line, not the instruction.'
                  : ''}
          {problem ?? player.error ? ` ${problem ?? player.error}` : ''}
        </span>
        <a className="st-preview-voice__note" href={routeHref({ name: 'voice' })}>
          Voice page
        </a>
        {draft !== null ? (
          <div className="st-preview-voice__words">
            <textarea
              value={draft}
              maxLength={240}
              rows={2}
              autoFocus
              aria-label="What Lina says here"
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="st-preview-voice__words-row">
              <button type="button" className="st-button st-button--primary" disabled={recording !== null} onClick={() => void saveWords()}>
                {recording === 'step' ? 'Recording…' : 'Save and record'}
              </button>
              <span className="st-preview-voice__note">
                {step.kind === 'step'
                  ? 'Only what is spoken changes; the instruction on the screen stays as it is. Leave it empty to speak the instruction.'
                  : 'Leave it empty for Lina’s usual words.'}{' '}
                {draft.length}/240
              </span>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
  // The player shows what Lina says around the lesson, and runs its intro for as long as she speaks.
  const part = (id: string) => narration?.steps.find((candidate) => candidate.stepId === id)
  const intro = part(INTRO_ID)
  const outro = part(OUTRO_ID)
  const introText = intro?.text
  const introSeconds = speak && intro?.take && intro.stale === null ? intro.take.durationMs / 1000 + 0.6 : undefined
  const outroText = outro?.text
  const lina = useMemo(
    () => ({
      ...(introText ? { intro: { text: introText, ...(introSeconds ? { seconds: introSeconds } : {}) } } : {}),
      ...(outroText ? { outro: { text: outroText } } : {}),
    }),
    [introSeconds, introText, outroText],
  )
  // ---------- the same voice in the Steps pane: a step's card, and the start and end of the lesson ----------
  const [busyId, setBusyId] = useState<string | null>(null)
  const recordPart = async (id: string, words?: string | null) => {
    const target = narration?.steps.find((candidate) => candidate.stepId === id)
    if (!target) return
    setBusyId(id)
    setProblem(null)
    try {
      if (words !== undefined) setNarration(await saveNarrationLine(lessonId, id, words))
      setNarration(await narrateStep(lessonId, id, { another: words === undefined && target.stale === null }))
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'The recording failed.')
    } finally {
      setBusyId(null)
    }
  }
  const voiceApi: PartVoiceApi = {
    saved,
    busyId,
    problem,
    cast: Boolean(narration?.castVoiceId),
    playingTakeId: player.playingTakeId,
    toggle: player.toggle,
    record: (id) => void recordPart(id),
    saveAndRecord: (id, words) => void recordPart(id, words),
  }
  const stepVoice = (id: string) => {
    const target = narration?.steps.find((candidate) => candidate.stepId === id)
    return target ? <PartVoice part={target} voice={voiceApi} /> : null
  }
  const bookend = (kind: 'intro' | 'outro') => {
    const target = narration?.steps.find((candidate) => candidate.kind === kind)
    return target ? <BookendCard key={`${target.stepId}:${target.text}`} part={target} voice={voiceApi} /> : null
  }

  return { onStep, controls, lina, stepVoice, bookend }
}

interface PartVoiceApi {
  saved: boolean
  busyId: string | null
  problem: string | null
  cast: boolean
  playingTakeId: string | null
  toggle: (takeId: string) => void
  record: (stepId: string) => void
  saveAndRecord: (stepId: string, words: string | null) => void
}

const STALE_NOTE = {
  missing: 'Not recorded yet.',
  'text-changed': 'The words changed since this was recorded.',
  'voice-changed': 'Recorded in another voice.',
} as const

/** Listen and record for one part of the lesson, on one line. */
function PartVoice({ part, voice }: { part: StepNarration; voice: PartVoiceApi }) {
  const busy = voice.busyId === part.stepId
  if (!voice.cast) {
    return (
      <p className="st-preview-voice__note">
        No voice is cast as Lina yet. <a href={routeHref({ name: 'voice' })}>Cast one on the Voice page</a>.
      </p>
    )
  }
  return (
    <div className="st-part-voice" role="group" aria-label={`Lina’s voice for ${part.title}`}>
      {part.take ? (
        <button type="button" className="st-button" onClick={() => voice.toggle(part.take!.id)} title={part.text}>
          {voice.playingTakeId === part.take.id ? '■ Stop' : '🔊 Listen'}
        </button>
      ) : null}
      <button type="button" className="st-button" disabled={voice.busyId !== null || !voice.saved} onClick={() => voice.record(part.stepId)}>
        {busy ? 'Recording…' : part.take ? (part.stale ? 'Record again' : 'Another take') : 'Record'}
      </button>
      <span className={`st-preview-voice__note ${part.stale ? 'is-stale' : ''}`}>
        {part.stale ? STALE_NOTE[part.stale] : `Recorded · ${Math.max(1, Math.round((part.take?.durationMs ?? 0) / 1000))}s`}
        {part.kind === 'step' && part.spokenLine ? ' Lina speaks her own line here, not this instruction (Voice page).' : ''}
        {busy || !voice.problem ? '' : ` ${voice.problem}`}
      </span>
    </div>
  )
}

/** What Lina says before or after the lesson: words the creator can rewrite, and the recording of them. */
function BookendCard({ part, voice }: { part: StepNarration; voice: PartVoiceApi }) {
  const [words, setWords] = useState(part.text)
  const changed = words.trim() !== part.text
  return (
    <div className="st-bookend">
      <label className="st-field">
        <span className="st-field__label">{part.kind === 'intro' ? 'Before the lesson · Lina says' : 'After the lesson · Lina says'}</span>
        <textarea
          className="st-field__input st-field__input--long"
          value={words}
          maxLength={240}
          rows={3}
          onChange={(event) => setWords(event.target.value)}
        />
      </label>
      {changed ? (
        <div className="st-part-voice">
          <button
            type="button"
            className="st-button st-button--primary"
            disabled={voice.busyId !== null}
            onClick={() => voice.saveAndRecord(part.stepId, words.trim() && words.trim() !== part.instruction ? words.trim() : null)}
          >
            {voice.busyId === part.stepId ? 'Recording…' : 'Save and record'}
          </button>
          <button type="button" className="st-button" onClick={() => setWords(part.text)}>
            Cancel
          </button>
          <span className="st-preview-voice__note">{words.length}/240 · empty brings back Lina’s usual words</span>
        </div>
      ) : (
        <PartVoice part={part} voice={voice} />
      )}
    </div>
  )
}
