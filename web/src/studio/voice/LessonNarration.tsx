import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LessonNarration as Narration, Voice } from '../../voice/types'
import { narrateStep, publishVoice, readLessonNarration, saveNarrationLine, unpublishVoice } from '../api'
import { ConfirmDialog } from '../ConfirmDialog'
import type { Library } from '../library'

import { formatDayAndTime, formatDuration, plural } from './format'
import { countLessons, groupLessonsByPath } from './lessonGroups'
import { describeStale, narrationHeadline, publishBlocker, stepsNeedingWork, summariseSteps } from './summary'
import type { AudioPlayer } from './useAudioPlayer'
import type { GenerationQueue } from './useGenerationQueue'

/** The generation queue's name for one step's recording, written once so both users of it agree. */
const stepKey = (lessonId: string, stepId: string) => `narrate ${lessonId} ${stepId}`

export interface LessonNarrationProps {
  library: Library
  voices: Voice[]
  castVoiceId: string | null
  player: AudioPlayer
  queue: GenerationQueue
  /** Why speech cannot be made right now, or null when the server is answering. */
  unavailable: string | null
}

/**
 * Narrating a lesson: one recording per step, in the voice cast as Lina, and
 * the one way those recordings reach `shared/Assets/Voice/<lessonId>/`, where
 * the iOS player looks for them.
 *
 * The page makes one step at a time rather than asking the server for the whole
 * lesson, so a sixteen-step lesson shows its progress and can be stopped.
 */
export function LessonNarrationPanel({
  library,
  voices,
  castVoiceId,
  player,
  queue,
  unavailable,
}: LessonNarrationProps) {
  const [lessonId, setLessonId] = useState('')
  const [narration, setNarration] = useState<Narration | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [published, setPublished] = useState<string[] | null>(null)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const [running, setRunning] = useState(false)

  const groups = useMemo(
    () =>
      groupLessonsByPath(
        library.catalog?.paths ?? [],
        [...library.tutorials.values()].map((entry) => ({ id: entry.id, title: entry.tutorial.title })),
      ),
    [library],
  )

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      setNarration(await readLessonNarration(id))
      setDrafts({})
    } catch (caught) {
      setNarration(null)
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!lessonId) {
      setNarration(null)
      return
    }
    void load(lessonId)
  }, [lessonId, load, castVoiceId])

  const castVoice = voices.find((voice) => voice.id === castVoiceId) ?? null
  const steps = narration?.steps ?? []
  const summary = summariseSteps(steps)
  const lessonPublished = library.publishing.publishedIds.includes(lessonId)
  const blocked = publishBlocker({ summary, lessonPublished, castVoiceId })

  /** Makes one step, through the page's queue, and keeps the newest answer. */
  const makeStep = useCallback(
    (stepId: string, another: boolean) =>
      queue.run(stepKey(lessonId, stepId), async () => {
        try {
          setNarration(await narrateStep(lessonId, stepId, { another }))
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught))
          throw caught
        }
      }),
    [lessonId, queue],
  )

  /**
   * Hands the whole run to the queue at once, so the toolbar can say "3 of 16"
   * and Stop can drop what has not started. The first failure stops the rest
   * rather than working through sixteen steps against a server that is down.
   */
  const makeAll = async (ids: string[], another: boolean) => {
    setRunning(true)
    setError(null)
    const run = ids.map((stepId) =>
      makeStep(stepId, another).catch((caught: unknown) => {
        queue.stop()
        throw caught
      }),
    )
    await Promise.allSettled(run)
    setRunning(false)
  }

  const stopRun = () => queue.stop()

  const writeLine = async (stepId: string, text: string | null) => {
    setError(null)
    try {
      setNarration(await saveNarrationLine(lessonId, stepId, text))
      setDrafts((current) => {
        const next = { ...current }
        delete next[stepId]
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const publish = async () => {
    setError(null)
    const result = await publishVoice(lessonId)
    setPublished(result.files)
    await load(lessonId)
  }

  return (
    <section className="st-panel st-narrate">
      <header className="st-narrate__head">
        <h2 className="st-label">Narrate a lesson</h2>
        <label className="st-narrate__picker">
          <span className="st-field__label">Lesson</span>
          <select
            className="st-field__input st-field__select"
            value={lessonId}
            onChange={(event) => {
              setLessonId(event.target.value)
              setPublished(null)
            }}
          >
            <option value="">Choose a lesson…</option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>

      {!lessonId ? (
        <p className="st-panel__note">
          {countLessons(groups) === 0
            ? 'No lessons in the workspace yet. Make one first, then come back and give it a voice.'
            : 'Choose a lesson and every step gets a recording in Lina’s voice.'}
        </p>
      ) : null}

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {lessonId && loading && !narration ? <p className="st-panel__note">Reading the lesson…</p> : null}

      {lessonId && narration ? (
        <>
          <p className="st-narrate__voice">
            {castVoice ? (
              <>
                Narrating as <strong>{castVoice.name}</strong>
                {castVoice.frozen ? ' · frozen' : ''}
              </>
            ) : (
              <span className="st-narrate__warning">No voice is cast as Lina yet. Cast one above first.</span>
            )}
          </p>

          <div className="st-narrate__toolbar">
            {/* Two buttons, not one restyled: a reused element keeps the primary button's colour transition. */}
            {running || queue.busy ? (
              <button key="stop" type="button" className="st-button st-button--compact" onClick={stopRun}>
                Stop{queue.progress ? ` · ${queue.progress}` : ''}
              </button>
            ) : (
              <button
                key="narrate"
                type="button"
                className="st-button st-button--compact st-button--primary"
                disabled={summary.needsWork === 0 || !castVoiceId || unavailable !== null}
                title={unavailable ?? undefined}
                onClick={() => void makeAll(stepsNeedingWork(steps), false)}
              >
                Narrate what’s missing
                {summary.needsWork > 0 ? ` (${summary.needsWork})` : ''}
              </button>
            )}
            <button
              type="button"
              className="st-button st-button--compact"
              disabled={running || queue.busy || steps.length === 0 || !castVoiceId || unavailable !== null}
              title={unavailable ?? undefined}
              onClick={() => void makeAll(steps.map((step) => step.stepId), true)}
            >
              Remake all
            </button>
            <span className="st-narrate__headline">{narrationHeadline(summary)}</span>
            <PublishButton blocked={blocked} onPublish={publish} lessonId={lessonId} steps={summary.total} />
          </div>

          {narration.published ? (
            <p className="st-narrate__published">
              Published {formatDayAndTime(narration.published.generatedAt)} ·{' '}
              {plural(narration.published.stepCount, 'step')} · {narration.published.voiceName}
              {narration.published.behind ? (
                <span className="st-narrate__behind"> · Behind: the workspace has newer recordings</span>
              ) : null}
              <button type="button" className="st-link-button" onClick={() => setConfirmUnpublish(true)}>
                Remove from shared/
              </button>
            </p>
          ) : null}

          {published ? (
            <div className="st-notice st-notice--success" role="status">
              <p>
                Written into <code>shared/</code>. {plural(published.length, 'file')} changed. Commit them with
                git:
              </p>
              <pre className="st-publish__command">git add shared/Assets/Voice/{lessonId}</pre>
            </div>
          ) : null}

          {steps.length === 0 ? (
            <p className="st-panel__note">This lesson has no steps yet, so there is nothing to say.</p>
          ) : (
            <table className="st-narrate__table">
              <thead>
                <tr>
                  <th scope="col" className="st-narrate__col-num">
                    #
                  </th>
                  <th scope="col">Step and what Lina says</th>
                  <th scope="col" className="st-narrate__col-state">
                    State
                  </th>
                  <th scope="col" className="st-narrate__col-do">
                    <span className="st-visually-hidden">Recording</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => {
                  const chip = describeStale(step.stale)
                  const key = stepKey(lessonId, step.stepId)
                  const making = queue.isRunning(key)
                  const waiting = queue.isQueued(key)
                  const written = step.spokenLine !== null
                  const draft = drafts[step.stepId]
                  const playing = step.take !== null && player.playingTakeId === step.take.id
                  return (
                    <tr key={step.stepId} className={making ? 'is-making' : ''}>
                      <td className="st-narrate__col-num">{index + 1}</td>
                      <td>
                        <p className="st-narrate__title">{step.title}</p>
                        {written || draft !== undefined ? (
                          <>
                            <textarea
                              className="st-field__input st-narrate__line"
                              rows={2}
                              value={draft ?? step.spokenLine ?? ''}
                              aria-label={`What Lina says at step ${index + 1}`}
                              onChange={(event) =>
                                setDrafts((current) => ({ ...current, [step.stepId]: event.target.value }))
                              }
                              onBlur={() => {
                                const next = drafts[step.stepId]
                                if (next === undefined || next === (step.spokenLine ?? '')) return
                                void writeLine(step.stepId, next.trim() ? next : null)
                              }}
                            />
                            <button
                              type="button"
                              className="st-narrate__action"
                              onClick={() => void writeLine(step.stepId, null)}
                            >
                              Use the instruction
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="st-narrate__instruction">{step.instruction}</p>
                            <button
                              type="button"
                              className="st-narrate__action"
                              onClick={() =>
                                setDrafts((current) => ({ ...current, [step.stepId]: step.instruction }))
                              }
                            >
                              Write a spoken line
                            </button>
                          </>
                        )}
                      </td>
                      <td className="st-narrate__col-state">
                        <span className={`st-voice-chip st-voice-chip--${chip.tone}`}>{chip.label}</span>
                        {step.take ? (
                          <span className="st-narrate__time">{formatDuration(step.take.durationMs)}</span>
                        ) : null}
                      </td>
                      <td className="st-narrate__col-do">
                        {step.take ? (
                          <button
                            type="button"
                            className="st-take__play st-take__play--small"
                            aria-label={`${playing ? 'Stop' : 'Play'} step ${index + 1}`}
                            onClick={() => player.toggle(step.take!.id)}
                          >
                            {playing ? '❚❚' : '▶'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="st-button st-button--compact"
                          disabled={making || waiting || !castVoiceId || unavailable !== null}
                          title={unavailable ?? undefined}
                          onClick={() => void makeStep(step.stepId, step.stale === null).catch(() => {})}
                        >
                          {making ? (
                            <span className="st-spinner" aria-hidden="true" />
                          ) : waiting ? (
                            'Queued'
                          ) : step.take ? (
                            'Remake'
                          ) : (
                            'Make'
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      ) : null}

      {confirmUnpublish ? (
        <ConfirmDialog
          title="Remove this lesson's audio from shared/?"
          confirmLabel="Remove the audio"
          busyLabel="Removing…"
          tone="danger"
          onClose={() => setConfirmUnpublish(false)}
          onConfirm={async () => {
            await unpublishVoice(lessonId)
            setPublished(null)
            await load(lessonId)
          }}
        >
          <p>
            <code>
              shared/Assets/Voice/{lessonId}/
            </code>{' '}
            is deleted. The recordings stay in your workspace, so publishing again costs nothing.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}

/** Publishing is the one irreversible-ish step here, so it asks first and says exactly what it will write. */
function PublishButton({
  blocked,
  lessonId,
  steps,
  onPublish,
}: {
  blocked: string | null
  lessonId: string
  steps: number
  onPublish(): Promise<void>
}) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button
        type="button"
        className="st-button st-button--compact"
        disabled={blocked !== null}
        title={blocked ?? 'Write the audio into shared/, where git tracks it.'}
        onClick={() => setAsking(true)}
      >
        Publish voice
      </button>
      {blocked ? <span className="st-narrate__blocked">{blocked}</span> : null}
      {asking ? (
        <ConfirmDialog
          title="Publish this lesson's voice?"
          confirmLabel="Publish the audio"
          busyLabel="Converting and writing…"
          onClose={() => setAsking(false)}
          onConfirm={onPublish}
        >
          <p>
            {plural(steps, 'recording')} become AAC files in{' '}
            <code>shared/Assets/Voice/{lessonId}/</code>, beside a <code>manifest.json</code>. Anything in that
            folder that is not in the manifest is removed. The Studio never commits: review the diff yourself.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  )
}
