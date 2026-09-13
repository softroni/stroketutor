import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type { LessonReference } from '../catalog/types'

export interface ReferencePanelProps {
  title: string
  reference?: LessonReference
  url?: string
  /** Null when uploading is possible; otherwise the reason it is not. */
  uploadBlockedBecause: string | null
  onUpload: (file: File, source: string, license: string) => Promise<void>
  /** Changes where the current photo came from and its licence, keeping the photo. */
  onUpdateDetails: (source: string, license: string) => Promise<void>
}

import { REFERENCE_TYPES, REFERENCE_TYPES_LABEL } from './referenceImage'

/** The source as a web address when it is one, so it can be opened. */
function sourceLink(source: string): URL | null {
  try {
    const parsed = new URL(source)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

/**
 * The real-world photo the lesson simplifies (§6: reality → interpretation →
 * drawing). A photo is only stored together with where it came from and the
 * terms it may be used under (§37, reference-image rights).
 */
export function ReferencePanel({
  title,
  reference,
  url,
  uploadBlockedBecause,
  onUpload,
  onUpdateDetails,
}: ReferencePanelProps) {
  const [editing, setEditing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState(reference?.source ?? '')
  const [license, setLicense] = useState(reference?.license ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const detailsFilled = source.trim().length > 0 && license.trim().length > 0
  const detailsChanged = source.trim() !== reference?.source || license.trim() !== reference?.license
  // With a photo already stored, the details can be corrected without choosing it again.
  const ready = detailsFilled && (file !== null || (reference !== undefined && detailsChanged))

  const startEditing = () => {
    setSource(reference?.source ?? '')
    setLicense(reference?.license ?? '')
    setFile(null)
    setError(null)
    setEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      if (file) await onUpload(file, source.trim(), license.trim())
      else await onUpdateDetails(source.trim(), license.trim())
      setEditing(false)
      setFile(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <form className="st-reference-form" onSubmit={submit}>
      {preview ? (
        <img className="st-reference-form__preview" src={preview} alt="" />
      ) : url ? (
        <img className="st-reference-form__preview" src={url} alt="" />
      ) : null}
      <label className="st-field">
        <span className="st-field__label">
          {reference ? 'New photo (optional)' : 'Photo'} ({REFERENCE_TYPES_LABEL}, up to 8 MB)
        </span>
        <input
          className="st-field__input"
          type="file"
          accept={REFERENCE_TYPES.join(',')}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="st-field">
        <span className="st-field__label">Source</span>
        <input
          className="st-field__input"
          value={source}
          placeholder="Where the photo came from: a URL, or “own photo”"
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <label className="st-field">
        <span className="st-field__label">Licence</span>
        <input
          className="st-field__input"
          value={license}
          placeholder="e.g. CC0, Unsplash License, own photo"
          onChange={(event) => setLicense(event.target.value)}
        />
      </label>
      {error ? (
        <p className="st-notice st-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="st-reference-form__actions">
        <button type="submit" className="st-button st-button--primary" disabled={!ready || busy}>
          {busy ? 'Saving…' : !reference ? 'Add photo' : file ? 'Replace photo' : 'Save details'}
        </button>
        {reference ? (
          <button type="button" className="st-button" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )

  if (reference && url && !editing) {
    const link = sourceLink(reference.source)
    const path = link ? decodeURIComponent(link.pathname).replace(/^\/+|\/+$/g, '').split('/').join(' › ') : ''
    return (
      <figure className="st-reference">
        <img src={url} alt={`Reference photo for ${title}`} />
        <figcaption>
          <dl className="st-reference__credits">
            <dt>Source</dt>
            <dd>
              {link ? (
                <a
                  className="st-reference__source"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.href}
                >
                  <span className="st-reference__host">{link.hostname.replace(/^www\./, '')}</span>
                  {path ? <span className="st-reference__path">{path}</span> : null}
                  <span aria-hidden="true" className="st-reference__external">
                    ↗
                  </span>
                </a>
              ) : (
                reference.source
              )}
            </dd>
            <dt>Licence</dt>
            <dd>
              <span className="st-reference__license">{reference.license}</span>
            </dd>
          </dl>
        </figcaption>
        {uploadBlockedBecause === null ? (
          <div className="st-reference__actions">
            <button type="button" className="st-link-button" onClick={startEditing}>
              Edit source &amp; licence…
            </button>
          </div>
        ) : null}
      </figure>
    )
  }

  if (uploadBlockedBecause !== null) {
    return <div className="st-panel__empty">No reference photo yet. {uploadBlockedBecause}</div>
  }

  return form
}
