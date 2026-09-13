import { useState } from 'react'

import type { ScriptLine, Take, Voice, VoiceInput } from '../../voice/types'
import { ApiError } from '../api'
import { ConfirmDialog } from '../ConfirmDialog'
import { Menu } from '../Menu'

import { formatDay, formatDuration } from './format'
import { LinaPortrait } from './LinaPortrait'
import { speechKey } from './takeKey'
import type { AudioPlayer } from './useAudioPlayer'
import type { GenerationQueue } from './useGenerationQueue'
import { VoiceForm } from './VoiceForm'

/** One line a voice can be asked to read: the script, plus whatever is in "Try a line". */
export interface AuditionLine {
  id: string
  label: string
  text: string
  /** The bake-off line, shown first and highlighted. */
  isTry?: boolean
}

export interface VoiceCardProps {
  voice: Voice
  cast: boolean
  lines: AuditionLine[]
  /** The recording this voice already has for these words, if any. */
  takeFor(voice: Voice, text: string): Take | null
  /** Everything this voice has recorded, newest first: what the freeze chooser offers. */
  takes: Take[]
  script: ScriptLine[]
  player: AudioPlayer
  queue: GenerationQueue
  /** Set while the speech server cannot be reached; the reason rides along in a tooltip. */
  unavailable: string | null
  onMake(voice: Voice, text: string, another: boolean): void
  onCast(voice: Voice): Promise<void>
  onSave(voice: Voice, input: VoiceInput): Promise<void>
  onDuplicate(voice: Voice): Promise<void>
  /** Refused while a lesson is narrated in this voice, until `force` says to do it anyway. */
  onDelete(voice: Voice, force: boolean): Promise<void>
  onFreeze(voice: Voice, takeId: string): Promise<void>
  onUnfreeze(voice: Voice): Promise<void>
}

const ENGINE_CHIP: Record<Voice['engine'], string> = {
  chatterbox: 'Chatterbox',
  'qwen-design': 'Designed',
  'qwen-custom': 'Speaker',
}

/**
 * One candidate for Lina's voice: who it is, and the same audition lines every
 * other card carries, so two voices can be compared by pressing the same row
 * twice. A designed voice drifts between takes, so it also carries the one
 * action that settles it for good — freezing.
 */
export function VoiceCard(props: VoiceCardProps) {
  const { voice, cast, lines, takeFor, takes, script, player, queue, unavailable } = props
  const [editing, setEditing] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [inUse, setInUse] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  /** Takes vary only for a designed or custom voice that has not been frozen. */
  const varies = voice.frozen === null && voice.engine !== 'chatterbox'
  const canFreeze = varies && takes.length > 0
  const chip = voice.engine === 'qwen-custom' && voice.speaker
    ? `Speaker: ${voice.speaker.replace(/_/g, ' ')}`
    : ENGINE_CHIP[voice.engine]

  /** The audition line a recording came from, for the freeze chooser and the frozen footer. */
  const labelOfText = (text: string) =>
    script.find((line) => line.text === text)?.label ?? `“${text.slice(0, 34)}${text.length > 34 ? '…' : ''}”`

  const act = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  if (editing) {
    return (
      <article className="st-voice-card st-voice-card--editing">
        <h3 className="st-voice-card__name">Edit {voice.name}</h3>
        <VoiceForm
          voice={voice}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await props.onSave(voice, input)
            setEditing(false)
          }}
        />
      </article>
    )
  }

  return (
    <article className={`st-voice-card ${cast ? 'is-cast' : ''}`}>
      <header className="st-voice-card__head">
        <div className="st-voice-card__identity">
          <h3 className="st-voice-card__name">{voice.name}</h3>
          <p className="st-voice-card__chips">
            <span className="st-voice-chip">{chip}</span>
            {voice.frozen ? (
              <span className="st-voice-chip st-voice-chip--clay" title={`Cloned from ${voice.frozen.referenceName}`}>
                Frozen ✓
              </span>
            ) : null}
            {voice.suggested ? <span className="st-voice-chip st-voice-chip--quiet">Suggested</span> : null}
          </p>
        </div>
        <Menu
          label={`More for ${voice.name}`}
          entries={[
            { label: 'Edit…', onSelect: () => setEditing(true) },
            { label: 'Duplicate', onSelect: () => void act('duplicate', () => props.onDuplicate(voice)) },
            'separator',
            { label: 'Delete…', danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>

      {voice.tagline ? <p className="st-voice-card__tagline">{voice.tagline}</p> : null}
      {voice.instruct ? <p className="st-voice-card__instruct">{voice.instruct}</p> : null}

      <ul className="st-takes">
        {lines.map((line) => {
          const key = speechKey(voice.id, line.text)
          const take = takeFor(voice, line.text)
          // Only one line is ever being made; the rest of a burst is waiting.
          const making = queue.isRunning(key)
          const waiting = queue.isQueued(key)
          const busy = making || waiting
          const playing = take !== null && player.playingTakeId === take.id
          return (
            <li
              key={line.id}
              className={`st-take ${line.isTry ? 'is-try' : ''} ${playing ? 'is-playing' : ''} ${
                making ? 'is-making' : ''
              }`}
            >
              {take && !busy ? (
                <button
                  type="button"
                  className="st-take__play"
                  aria-label={`${playing ? 'Stop' : 'Play'} ${voice.name} saying ${line.label}`}
                  onClick={() => player.toggle(take.id)}
                >
                  {playing ? '❚❚' : '▶'}
                </button>
              ) : (
                <button
                  type="button"
                  className="st-take__play st-take__play--make"
                  disabled={busy || unavailable !== null}
                  title={unavailable ?? undefined}
                  aria-label={`Make ${voice.name} saying ${line.label}`}
                  onClick={() => props.onMake(voice, line.text, false)}
                >
                  {making ? <span className="st-spinner" aria-hidden="true" /> : waiting ? '···' : 'Make'}
                </button>
              )}
              <span className="st-take__label">{line.label}</span>
              <span className="st-take__time">
                {making ? (
                  <span className="st-take__making">Making{queue.progress ? ` · ${queue.progress}` : ''}…</span>
                ) : waiting ? (
                  <span className="st-take__waiting">In the queue</span>
                ) : take ? (
                  formatDuration(take.durationMs)
                ) : null}
              </span>
              {take && varies && !busy ? (
                <button
                  type="button"
                  className="st-take__again"
                  title="Make another take of this line"
                  aria-label={`Another take of ${line.label} in ${voice.name}`}
                  disabled={unavailable !== null}
                  onClick={() => props.onMake(voice, line.text, true)}
                >
                  ↻
                </button>
              ) : (
                <span className="st-take__again-spacer" aria-hidden="true" />
              )}
              {playing ? (
                <span className="st-take__progress" aria-hidden="true">
                  <span style={{ transform: `scaleX(${player.progress})` }} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <footer className="st-voice-card__footer">
        {cast ? (
          <span className="st-cast-badge" title="This is the voice every lesson is narrated in.">
            <LinaPortrait size={22} />
            Lina ✓
          </span>
        ) : (
          <button
            type="button"
            className="st-button st-button--compact st-button--primary"
            disabled={busy === 'cast'}
            onClick={() => void act('cast', () => props.onCast(voice))}
          >
            {busy === 'cast' ? 'Casting…' : 'Cast as Lina'}
          </button>
        )}

        {voice.frozen ? (
          <span className="st-voice-card__frozen">
            <button
              type="button"
              className="st-take__play st-take__play--small"
              aria-label="Play the reference this voice is cloned from"
              onClick={() => player.toggle(voice.frozen!.takeId)}
            >
              {player.playingTakeId === voice.frozen.takeId ? '❚❚' : '▶'}
            </button>
            <span>
              Frozen from {labelOfText(voice.frozen.referenceText)} on {formatDay(voice.frozen.frozenAt)}
            </span>
            <button
              type="button"
              className="st-link-button"
              disabled={busy === 'unfreeze'}
              onClick={() => void act('unfreeze', () => props.onUnfreeze(voice))}
            >
              {busy === 'unfreeze' ? 'Unfreezing…' : 'Unfreeze'}
            </button>
          </span>
        ) : varies ? (
          <button
            type="button"
            className="st-button st-button--compact"
            disabled={!canFreeze || unavailable !== null}
            title={
              unavailable ??
              (canFreeze
                ? 'Upload one take as a reference, so this voice stops varying.'
                : 'Make a take first: freezing keeps one recording as the reference.')
            }
            onClick={() => setFreezing(true)}
          >
            Freeze this voice…
          </button>
        ) : null}
      </footer>

      {freezing ? (
        <FreezeChooser
          voice={voice}
          takes={takes}
          labelOf={labelOfText}
          player={player}
          onClose={() => setFreezing(false)}
          onFreeze={(takeId) => props.onFreeze(voice, takeId)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${voice.name}?`}
          confirmLabel={inUse ? 'Delete it anyway' : 'Delete the voice'}
          busyLabel="Deleting…"
          tone="danger"
          onClose={() => {
            setConfirmDelete(false)
            setInUse(false)
          }}
          onConfirm={async () => {
            try {
              await props.onDelete(voice, inUse)
            } catch (caught) {
              // 409: lessons are narrated in this voice. Say so, and let the
              // same button mean "anyway" the second time.
              if (caught instanceof ApiError && caught.status === 409) setInUse(true)
              throw caught
            }
          }}
        >
          <p>
            Its takes go with it. A suggested voice that is deleted does not come back. Nothing already
            published to <code>shared/</code> is touched.
          </p>
          {inUse ? (
            <p>
              Lessons are narrated in this voice. Deleting it leaves those recordings without a voice, and
              their steps will ask to be made again.
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </article>
  )
}

/**
 * Choosing which recording becomes the reference. A clone is only as good as
 * what it copies, so the list says how long each take is and marks the ones
 * outside the five-to-fifteen seconds the server likes.
 */
function FreezeChooser({
  voice,
  takes,
  labelOf,
  player,
  onFreeze,
  onClose,
}: {
  voice: Voice
  takes: Take[]
  labelOf(text: string): string
  player: AudioPlayer
  onFreeze(takeId: string): Promise<void>
  onClose(): void
}) {
  const [chosen, setChosen] = useState<string>(
    () => takes.find((take) => take.durationMs >= 5000 && take.durationMs <= 15_000)?.id ?? takes[0]?.id ?? '',
  )

  return (
    <ConfirmDialog
      title={`Freeze ${voice.name}`}
      confirmLabel="Freeze from this take"
      busyLabel="Uploading the reference…"
      confirmDisabled={!chosen}
      onClose={onClose}
      onConfirm={() => onFreeze(chosen)}
    >
      <p>
        The take you choose is uploaded to the speech server as this voice's reference. Every later line is
        cloned from it, so the voice stops drifting. Five to fifteen seconds of clear speech works best.
      </p>
      <ul className="st-freeze-list">
        {takes.map((take) => {
          const good = take.durationMs >= 5000 && take.durationMs <= 15_000
          return (
            <li key={take.id}>
              <label className="st-freeze-option">
                <input
                  type="radio"
                  name="freeze-take"
                  value={take.id}
                  checked={chosen === take.id}
                  onChange={() => setChosen(take.id)}
                />
                <span className="st-freeze-option__label">{labelOf(take.text)}</span>
                <span className={`st-freeze-option__time ${good ? '' : 'is-off'}`}>
                  {formatDuration(take.durationMs)}
                  {good ? '' : take.durationMs < 5000 ? ' · short' : ' · long'}
                </span>
                <button
                  type="button"
                  className="st-take__play st-take__play--small"
                  aria-label={`Play ${labelOf(take.text)}`}
                  onClick={() => player.toggle(take.id)}
                >
                  {player.playingTakeId === take.id ? '❚❚' : '▶'}
                </button>
              </label>
            </li>
          )
        })}
      </ul>
    </ConfirmDialog>
  )
}
