import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { TutorialPlayerProps } from '../../player/TutorialPlayer'
import { INTRO_ID, OUTRO_ID } from '../../voice/bookends'

import type { LessonNarration } from '../../voice/types'
import { narrateStep, readLessonNarration } from '../api'
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
): { onStep: (stepId: string, run: number) => void; controls: ReactNode; lina: TutorialPlayerProps['lina'] } {
  const player = useAudioPlayer()
  const [narration, setNarration] = useState<LessonNarration | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const [recording, setRecording] = useState<'step' | 'all' | null>(null)
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
  return { onStep, controls, lina }
}
