import { useEffect, useMemo, useState } from 'react'

import { listModels, readSettings, type VisionModel } from './api'
import { storeModel } from './settings'

/**
 * The chosen model, changeable where generation happens: New lesson and the
 * Regenerate panel. A choice is saved exactly as Settings saves it, so
 * Settings, the other page and the next visit all use it.
 */
export function ModelPicker({
  model,
  onChange,
  disabled = false,
}: {
  /** The stored choice; empty when none, in which case the server default applies. */
  model: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [defaultModel, setDefaultModel] = useState<string | null>(null)

  useEffect(() => {
    readSettings()
      .then((settings) => setDefaultModel(settings.defaultModel))
      .catch(() => setDefaultModel(null))
  }, [])

  const effective = model || defaultModel || ''

  return (
    <div className="st-model-picker">
      <p className="st-field__hint">
        {effective ? (
          <>
            With <code>{effective}</code>
            {!model && defaultModel ? ' (the server default)' : ''}.
          </>
        ) : (
          'No model chosen yet.'
        )}{' '}
        <button
          type="button"
          className="st-link-button"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Close the list' : effective ? 'Change model' : 'Choose a model'}
        </button>
      </p>
      {open && !disabled ? (
        <ModelList
          model={model}
          effective={effective}
          compact
          onChoose={(id) => {
            storeModel(id)
            onChange(id)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * The models OpenRouter currently offers that take a photo and answer in
 * structured text, filterable, with prices. Shared by Settings and the picker.
 */
export function ModelList({
  model,
  effective,
  onChoose,
  compact = false,
}: {
  /** The stored choice, marked as selected. */
  model: string
  /** What generation will actually use, warned about when it is not in the list. */
  effective: string
  onChoose: (id: string) => void
  compact?: boolean
}) {
  const [models, setModels] = useState<VisionModel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    listModels()
      .then((result) => setModels(result.models))
      .catch((caught: Error) => {
        setError(caught.message)
        setModels([])
      })
  }, [])

  const shown = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return (models ?? []).filter(
      (candidate) =>
        !query || candidate.id.toLowerCase().includes(query) || candidate.name.toLowerCase().includes(query),
    )
  }, [models, filter])

  return (
    <div className="st-model-picker__list">
      {effective && models && models.length > 0 && !models.some((candidate) => candidate.id === effective) ? (
        <p className="st-notice st-notice--error" role="alert">
          <code>{effective}</code> is not in the list below: it either makes images rather than writing text,
          or no longer takes a photo with structured output. Generating with it will likely fail; choose a
          model below.
        </p>
      ) : null}
      <label className="st-field">
        <span className="st-field__label">Filter</span>
        <input
          className="st-field__input"
          value={filter}
          placeholder="e.g. claude, gemini, gpt"
          autoFocus={compact}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : models === null ? (
        <p className="st-field__hint">Loading the model list…</p>
      ) : models.length === 0 ? (
        <p className="st-field__hint">OpenRouter's model list could not be loaded. Check the network connection.</p>
      ) : (
        <ul className={`st-model-list ${compact ? 'st-model-list--compact' : ''}`} aria-label="Models">
          {shown.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className={`st-model-list__item ${candidate.id === model ? 'is-selected' : ''}`}
                aria-pressed={candidate.id === model}
                onClick={() => onChoose(candidate.id)}
              >
                <span className="st-model-list__name">{candidate.name}</span>
                <code className="st-model-list__id">{candidate.id}</code>
                <span className="st-model-list__price">
                  {formatPrice(candidate.promptPerMillion)} / {formatPrice(candidate.completionPerMillion)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatPrice(value: number | null): string {
  return value === null ? '?' : `$${value}`
}
