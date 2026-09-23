import { useCallback, useEffect, useState } from 'react'

import type { AppNarration, Voice } from '../../voice/types'
import { narrateAppLine, publishAppLines, readAppLines, saveAppLine, unpublishAppLines } from '../api'
import { ConfirmDialog } from '../ConfirmDialog'

import { formatDayAndTime, formatDuration, plural } from './format'
import { appLinesNeedingWork, appPublishBlocker, describeStale, narrationHeadline, summariseSteps } from './summary'
import type { AudioPlayer } from './useAudioPlayer'
import type { GenerationQueue } from './useGenerationQueue'

/** The generation queue's name for one app line's recording. */
const lineKey = (id: string) => `narrate app ${id}`

export interface AppLinesProps {
  voices: Voice[]
  castVoiceId: string | null
  player: AudioPlayer
  queue: GenerationQueue
  /** Why speech cannot be made right now, or null when the server is answering. */
  unavailable: string | null
}

/**
 * Lina's own lines: the things the app says outside any lesson — the voice
 * introducing herself on the onboarding screen and in Settings, what she says
 * when each lesson and each path is finished, and what she says the first
 * time an early learner lands on All paths.
 *
 * It is the narration table again, with two differences. The ids are the app's
 * and cannot be added to, renamed or deleted — iOS looks each one up by name —
 * so there is no "add a line" anywhere here; and the words are always written
 * (there is no instruction to fall back on), so every row is an open text box.
 */
export function AppLinesPanel({ voices, castVoiceId, player, queue, unavailable }: AppLinesProps) {
  const [narration, setNarration] = useState<AppNarration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [published, setPublished] = useState<string[] | null>(null)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    try {
      setNarration(await readAppLines())
      setDrafts({})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  // Re-read when the casting changes: every line's state depends on who Lina is.
  useEffect(() => {
    void load()
  }, [load, castVoiceId])

  const cast = voices.find((voice) => voice.id === castVoiceId) ?? null
  const lines = narration?.lines ?? []
  const summary = summariseSteps(lines)
  const blocked = appPublishBlocker({ summary, castVoiceId })

  /** Makes one line, through the page's one queue, and keeps the newest answer. */
  const makeLine = useCallback(
    (id: string, another: boolean) =>
      queue.run(lineKey(id), async () => {
        try {
          setNarration(await narrateAppLine(id, { another }))
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught))
          throw caught
        }
      }),
    [queue],
  )

  /** The whole run at once, so the toolbar can count it and Stop can drop the rest. */
  const makeAll = async (ids: string[], another: boolean) => {
    setRunning(true)
    setError(null)
    const run = ids.map((id) =>
      makeLine(id, another).catch((caught: unknown) => {
        queue.stop()
        throw caught
      }),
    )
    await Promise.allSettled(run)
    setRunning(false)
  }

  const writeLine = async (id: string, text: string) => {
    setError(null)
    try {
      setNarration(await saveAppLine(id, text))
      setDrafts((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <section className="st-panel st-narrate st-app-lines">
      <h2 className="st-label">Lina’s own lines</h2>
      <p className="st-field__hint">
        What the app says outside any lesson: the voice introducing herself, the eight completion
        screens, and the one-time welcome to All paths. The ids are fixed — iOS asks for each by name —
        but the words are yours.
      </p>

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      {!narration ? (
        <p className="st-panel__note">Reading Lina’s own lines…</p>
      ) : (
        <>
          <p className="st-narrate__voice">
            {cast ? (
              <>
                Narrating as <strong>{cast.name}</strong>
                {cast.frozen ? ' · frozen' : ''}
              </>
            ) : (
              <span className="st-narrate__warning">No voice is cast as Lina yet. Cast one above first.</span>
            )}
          </p>

          <div className="st-narrate__toolbar">
            {running || queue.busy ? (
              <button key="stop" type="button" className="st-button st-button--compact" onClick={() => queue.stop()}>
                Stop{queue.progress ? ` · ${queue.progress}` : ''}
              </button>
            ) : (
              <button
                key="record"
                type="button"
                className="st-button st-button--compact st-button--primary"
                disabled={summary.needsWork === 0 || !castVoiceId || unavailable !== null}
                title={unavailable ?? undefined}
                onClick={() => void makeAll(appLinesNeedingWork(lines), false)}
              >
                Record what’s missing
                {summary.needsWork > 0 ? ` (${summary.needsWork})` : ''}
              </button>
            )}
            <button
              type="button"
              className="st-button st-button--compact"
              disabled={running || queue.busy || lines.length === 0 || !castVoiceId || unavailable !== null}
              title={unavailable ?? undefined}
              onClick={() => void makeAll(lines.map((line) => line.id), true)}
            >
              Remake all
            </button>
            <span className="st-narrate__headline">{narrationHeadline(summary, 'line')}</span>
            <PublishAppLinesButton
              blocked={blocked}
              lines={summary.total}
              onPublish={async () => {
                setError(null)
                const result = await publishAppLines()
                setPublished(result.files)
                await load()
              }}
            />
          </div>

          {narration.published ? (
            <p className="st-narrate__published">
              Published {formatDayAndTime(narration.published.generatedAt)} ·{' '}
              {plural(narration.published.lineCount, 'line')} · {narration.published.voiceName}
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
              <pre className="st-publish__command">git add shared/Assets/Voice/app</pre>
            </div>
          ) : null}

          <table className="st-narrate__table">
            <thead>
              <tr>
                <th scope="col" className="st-narrate__col-num">
                  #
                </th>
                <th scope="col">Where it plays, and what Lina says</th>
                <th scope="col" className="st-narrate__col-state">
                  State
                </th>
                <th scope="col" className="st-narrate__col-do">
                  <span className="st-visually-hidden">Recording</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const chip = describeStale(line.stale)
                const key = lineKey(line.id)
                const making = queue.isRunning(key)
                const waiting = queue.isQueued(key)
                const draft = drafts[line.id]
                const playing = line.take !== null && player.playingTakeId === line.take.id
                return (
                  <tr key={line.id} className={making ? 'is-making' : ''}>
                    <td className="st-narrate__col-num">{index + 1}</td>
                    <td>
                      <p className="st-narrate__title">
                        {line.where}
                        <code className="st-app-lines__id">{line.id}</code>
                      </p>
                      <textarea
                        className="st-field__input st-narrate__line"
                        rows={2}
                        value={draft ?? line.text}
                        aria-label={`What Lina says: ${line.where}`}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [line.id]: event.target.value }))
                        }
                        onBlur={() => {
                          const next = drafts[line.id]
                          if (next === undefined || next.trim() === line.text) return
                          void writeLine(line.id, next)
                        }}
                      />
                    </td>
                    <td className="st-narrate__col-state">
                      <span className={`st-voice-chip st-voice-chip--${chip.tone}`}>{chip.label}</span>
                      {line.take ? (
                        <span className="st-narrate__time">{formatDuration(line.take.durationMs)}</span>
                      ) : null}
                    </td>
                    <td className="st-narrate__col-do">
                      {line.take ? (
                        <button
                          type="button"
                          className="st-take__play st-take__play--small"
                          aria-label={`${playing ? 'Stop' : 'Play'} ${line.where}`}
                          onClick={() => player.toggle(line.take!.id)}
                        >
                          {playing ? '❚❚' : '▶'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="st-button st-button--compact"
                        disabled={making || waiting || !castVoiceId || unavailable !== null}
                        title={unavailable ?? undefined}
                        onClick={() => void makeLine(line.id, line.stale === null).catch(() => {})}
                      >
                        {making ? (
                          <span className="st-spinner" aria-hidden="true" />
                        ) : waiting ? (
                          'Queued'
                        ) : line.take ? (
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
        </>
      )}

      {confirmUnpublish ? (
        <ConfirmDialog
          title="Remove Lina's own lines from shared/?"
          confirmLabel="Remove the audio"
          busyLabel="Removing…"
          tone="danger"
          onClose={() => setConfirmUnpublish(false)}
          onConfirm={async () => {
            await unpublishAppLines()
            setPublished(null)
            await load()
          }}
        >
          <p>
            <code>shared/Assets/Voice/app/</code> is deleted, and the app has nothing to say on its
            onboarding and completion screens until it is published again. The recordings stay in your
            workspace, so publishing again costs nothing.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}

/** Publishing asks first and says exactly what it will write, as a lesson's does. */
function PublishAppLinesButton({
  blocked,
  lines,
  onPublish,
}: {
  blocked: string | null
  lines: number
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
        Publish Lina’s lines
      </button>
      {blocked ? <span className="st-narrate__blocked">{blocked}</span> : null}
      {asking ? (
        <ConfirmDialog
          title="Publish Lina's own lines?"
          confirmLabel="Publish the audio"
          busyLabel="Converting and writing…"
          onClose={() => setAsking(false)}
          onConfirm={onPublish}
        >
          <p>
            {plural(lines, 'recording')} become AAC files in <code>shared/Assets/Voice/app/</code>, beside a{' '}
            <code>manifest.json</code>. Anything in that folder that is not in the manifest is removed. The
            Studio never commits: review the diff yourself.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  )
}
