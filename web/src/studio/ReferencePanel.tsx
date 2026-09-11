import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type { LessonReference } from '../catalog/types'

export interface ReferencePanelProps {
  title: string
  reference?: LessonReference
  url?: string
  /** Null when uploading is possible; otherwise the reason it is not. */
  uploadBlockedBecause: string | null
  onUpload: (file: File, source: string, license: string) => Promise<void>
}

const ACCEPTED = 'image/jpeg,image/png,image/webp'

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

  const ready = file !== null && source.trim().length > 0 && license.trim().length > 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !ready) return
    setBusy(true)
    setError(null)
    try {
      await onUpload(file, source.trim(), license.trim())
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
      {preview ? <img className="st-reference-form__preview" src={preview} alt="" /> : null}
      <label className="st-field">
        <span className="st-field__label">Photo (JPEG, PNG or WebP, up to 8 MB)</span>
        <input
          className="st-field__input"
          type="file"
          accept={ACCEPTED}
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
          {busy ? 'Saving…' : reference ? 'Replace photo' : 'Add photo'}
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
    return (
      <figure className="st-reference">
        <img src={url} alt={`Reference photo for ${title}`} />
        <figcaption>
          {reference.source} · {reference.license}
        </figcaption>
        {uploadBlockedBecause === null ? (
          <button type="button" className="st-link-button" onClick={() => setEditing(true)}>
            Replace photo…
          </button>
        ) : null}
      </figure>
    )
  }

  if (uploadBlockedBecause !== null) {
    return <div className="st-panel__empty">No reference photo yet. {uploadBlockedBecause}</div>
  }

  return form
}
