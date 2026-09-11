import { useEffect, useMemo, useState } from 'react'

import { listModels, readSettings, type StudioSettings, type VisionModel } from './api'
import type { Library } from './library'
import { storeModel, storedModel } from './settings'

/**
 * Generation settings (master plan §14): whether an OpenRouter key is set up,
 * and which model to use. The list comes live from OpenRouter, filtered to
 * models that take images and honour structured output, because the right
 * model will change as they are tested (§39).
 */
export function SettingsView({ library }: { library: Library }) {
  const [settings, setSettings] = useState<StudioSettings | null>(null)
  const [models, setModels] = useState<VisionModel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState(storedModel)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!library.writable) return
    readSettings()
      .then(setSettings)
      .catch((caught: Error) => setError(caught.message))
    listModels()
      .then((result) => setModels(result.models))
      .catch((caught: Error) => setError(caught.message))
  }, [library.writable])

  const shown = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return (models ?? []).filter(
      (candidate) =>
        !query || candidate.id.toLowerCase().includes(query) || candidate.name.toLowerCase().includes(query),
    )
  }, [models, filter])

  const choose = (id: string) => {
    setModel(id)
    storeModel(id)
  }

  const effective = model || settings?.defaultModel || ''

  return (
    <div className="st-form-page">
      <h1 className="st-form-page__title">Settings</h1>

      {!library.writable ? (
        <p className="st-notice">Generation needs the Studio server. Run npm run dev.</p>
      ) : null}
      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="st-panel">
        <h2 className="st-label">OpenRouter key</h2>
        {settings === null ? (
          <p className="st-field__hint">Checking…</p>
        ) : settings.keyConfigured ? (
          <p className="st-valid">
            A key is configured on the Studio server. It stays there: the browser never sees it.
          </p>
        ) : (
          <p>
            No key yet. Add <code>OPENROUTER_API_KEY=…</code> to <code>web/.env.local</code> (ignored by git),
            then restart <code>npm run dev</code>.
          </p>
        )}
      </section>

      <section className="st-panel">
        <h2 className="st-label">Model</h2>
        <p className="st-field__hint">
          Models that accept a photo and can be held to the lesson's JSON shape, as OpenRouter lists them
          now. Prices are US dollars per million tokens, input / output.
        </p>
        <p>
          Generating with: <strong>{effective || 'no model chosen'}</strong>
          {!model && settings?.defaultModel ? ' (OPENROUTER_MODEL default)' : ''}
        </p>
        <label className="st-field">
          <span className="st-field__label">Filter</span>
          <input
            className="st-field__input"
            value={filter}
            placeholder="e.g. claude, gemini, gpt"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        {models === null ? (
          <p className="st-field__hint">Loading the model list…</p>
        ) : models.length === 0 ? (
          <p className="st-field__hint">OpenRouter's model list could not be loaded. Check the network connection.</p>
        ) : (
          <ul className="st-model-list" aria-label="Models">
            {shown.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  className={`st-model-list__item ${candidate.id === model ? 'is-selected' : ''}`}
                  aria-pressed={candidate.id === model}
                  onClick={() => choose(candidate.id)}
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
      </section>

      <section className="st-panel">
        <h2 className="st-label">Privacy</h2>
        <p>
          Pressing Generate sends the reference photo, the learning goal and the titles and objectives of
          the path's earlier lessons to the chosen model through OpenRouter. Nothing is sent at any other
          time, and nothing about learners is ever sent.
        </p>
      </section>
    </div>
  )
}

function formatPrice(value: number | null): string {
  return value === null ? '?' : `$${value}`
}
