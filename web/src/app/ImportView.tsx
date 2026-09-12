import { useCallback, useState } from 'react'

import { TutorialPlayer } from '../player/TutorialPlayer'
import type { Sample } from '../samples'
import type { Tutorial } from '../schema/types'
import { parseTutorialJSON, type ValidationIssue } from '../schema/validate'

import { DebugPanel } from './DebugPanel'
import { TutorialSource } from './TutorialSource'
import './app.css'

const DEFAULT_SAMPLE = 'simple-house.json'

interface Loaded {
  tutorial: Tutorial
  label: string
  /** Bumped on every successful load so the player remounts with fresh state. */
  generation: number
}

export interface ImportViewProps {
  /** Every lesson in the working library, as raw text. */
  samples: Sample[]
}

/**
 * Load any tutorial JSON — a sample, picked, dropped or pasted — then validate
 * and play it. Nothing here is saved; it is the quickest way to try a
 * hand-edited or generated document against the real player.
 */
export function ImportView({ samples }: ImportViewProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(() => {
    const first = samples.find((sample) => sample.fileName === DEFAULT_SAMPLE) ?? samples[0]
    const result = first ? parseTutorialJSON(first.source) : null
    return first && result?.ok ? { tutorial: result.tutorial, label: first.fileName, generation: 0 } : null
  })
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [failedLabel, setFailedLabel] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const handleLoadText = useCallback((text: string, label: string) => {
    const result = parseTutorialJSON(text)
    if (!result.ok) {
      // The previous document stays on the canvas: a blank canvas with no
      // explanation is the one outcome that helps nobody.
      setIssues(result.issues)
      setFailedLabel(label)
      return
    }
    setIssues(null)
    setFailedLabel(null)
    setLoaded((previous) => ({
      tutorial: result.tutorial,
      label,
      generation: (previous?.generation ?? 0) + 1,
    }))
  }, [])

  return (
    <div className="st-import">
      <div className="st-import__bar">
        <div>
          <h1 className="st-import__title">Import &amp; test</h1>
          <p className="st-import__note">
            Load any tutorial JSON to validate it and play it. Nothing here is saved.
          </p>
        </div>
        <button
          type="button"
          className={`st-button ${debugOpen ? 'st-button--on' : ''}`}
          onClick={() => setDebugOpen((open) => !open)}
          aria-pressed={debugOpen}
          disabled={!loaded}
        >
          {debugOpen ? 'Hide debug' : 'Show debug'}
        </button>
      </div>

      <div className={`st-app__main ${debugOpen && loaded ? 'is-debugging' : ''}`}>
        <TutorialSource
          samples={samples}
          onLoadText={handleLoadText}
          activeLabel={loaded?.label ?? 'nothing yet'}
          issues={issues}
          failedLabel={failedLabel}
        />

        <div className="st-app__stage">
          {loaded ? (
            <TutorialPlayer key={loaded.generation} tutorial={loaded.tutorial} />
          ) : (
            <p className="st-import__note">Load a tutorial to play it here.</p>
          )}
        </div>

        {debugOpen && loaded ? (
          <DebugPanel tutorial={loaded.tutorial} onClose={() => setDebugOpen(false)} />
        ) : null}
      </div>
    </div>
  )
}
