import { useId, useState, type FormEvent } from 'react'

import { QWEN_SPEAKERS, type QwenSpeaker, type Voice, type VoiceEngine, type VoiceInput } from '../../voice/types'

const ENGINES: { id: VoiceEngine; name: string; about: string }[] = [
  { id: 'qwen-design', name: 'Designed', about: 'A voice invented from your description. Varies a little until frozen.' },
  { id: 'qwen-custom', name: 'Speaker', about: 'One of nine fixed speakers; your description steers the delivery.' },
  { id: 'chatterbox', name: 'Chatterbox', about: 'One fixed English voice. Fast and steady, nothing to style.' },
]

const DESCRIPTION_LABEL: Record<VoiceEngine, string> = {
  'qwen-design': 'Describe the person',
  'qwen-custom': 'Describe the delivery',
  chatterbox: 'Description',
}

export interface VoiceFormProps {
  /** The voice being changed, or nothing when a new one is being added. */
  voice?: Voice
  submitLabel: string
  onSubmit(input: VoiceInput): Promise<void>
  onCancel?: () => void
}

/**
 * The one form for adding a voice and for editing one. The description's
 * placeholder is the whole lesson of this page: a good voice comes from
 * describing a person, not from adjectives about audio.
 */
export function VoiceForm({ voice, submitLabel, onSubmit, onCancel }: VoiceFormProps) {
  const group = useId()
  const [name, setName] = useState(voice?.name ?? '')
  const [tagline, setTagline] = useState(voice?.tagline ?? '')
  const [engine, setEngine] = useState<VoiceEngine>(voice?.engine ?? 'qwen-design')
  const [speaker, setSpeaker] = useState<QwenSpeaker>(voice?.speaker ?? QWEN_SPEAKERS[0])
  const [instruct, setInstruct] = useState(voice?.instruct ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const frozen = Boolean(voice?.frozen)
  const ready = name.trim().length > 0 && !busy

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        tagline: tagline.trim(),
        engine,
        instruct: engine === 'chatterbox' ? '' : instruct.trim(),
        speaker: engine === 'qwen-custom' ? speaker : null,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="st-voice-form" onSubmit={submit}>
      <label className="st-field">
        <span className="st-field__label">Name</span>
        <input
          className="st-field__input"
          value={name}
          placeholder="Lina, bright"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="st-field">
        <span className="st-field__label">Tagline</span>
        <input
          className="st-field__input"
          value={tagline}
          placeholder="Warm and genuinely excited to teach you"
          autoComplete="off"
          onChange={(event) => setTagline(event.target.value)}
        />
      </label>

      <fieldset className="st-voice-form__engines" disabled={frozen}>
        <legend className="st-field__label">How it is made</legend>
        {ENGINES.map((option) => (
          <label key={option.id} className={`st-voice-form__engine ${engine === option.id ? 'is-chosen' : ''}`}>
            <input
              type="radio"
              name={`${group}-engine`}
              value={option.id}
              checked={engine === option.id}
              onChange={() => setEngine(option.id)}
            />
            <span>
              <strong>{option.name}</strong>
              <span className="st-field__hint">{option.about}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {frozen ? (
        <p className="st-field__hint">
          This voice is frozen, so how it is made cannot change. Unfreeze it first; the name and tagline can
          still be edited.
        </p>
      ) : null}

      {engine === 'qwen-custom' ? (
        <label className="st-field">
          <span className="st-field__label">Speaker</span>
          <select
            className="st-field__input st-field__select"
            value={speaker}
            disabled={frozen}
            onChange={(event) => setSpeaker(event.target.value as QwenSpeaker)}
          >
            {QWEN_SPEAKERS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {engine === 'chatterbox' ? (
        <p className="st-field__hint">Chatterbox has one voice and ignores any description.</p>
      ) : (
        <label className="st-field">
          <span className="st-field__label">{DESCRIPTION_LABEL[engine]}</span>
          <textarea
            className="st-field__input st-field__input--long"
            value={instruct}
            disabled={frozen}
            placeholder="Describe the person, not the words: age, warmth, pace, what she is like when a line goes right."
            onChange={(event) => setInstruct(event.target.value)}
          />
        </label>
      )}

      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="st-voice-form__actions">
        <button type="submit" className="st-button st-button--compact st-button--primary" disabled={!ready}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="st-button st-button--compact" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
