import { useCallback, useState } from 'react'

import { TutorialPlayer } from '../player/TutorialPlayer'
import { DEFAULT_SAMPLE, loadSample } from '../samples'
import type { Tutorial } from '../schema/types'
import { parseTutorialJSON, type ValidationIssue } from '../schema/validate'

import { DebugPanel } from './DebugPanel'
import { TutorialSource } from './TutorialSource'
import './app.css'

interface Loaded {
  tutorial: Tutorial
  label: string
  /** Bumped on every successful load so the player remounts with fresh state. */
  generation: number
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded>(() => ({
    tutorial: loadSample(DEFAULT_SAMPLE),
    label: DEFAULT_SAMPLE,
    generation: 0,
  }))
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
      generation: previous.generation + 1,
    }))
  }, [])

  return (
    <div className="st-app">
      <header className="st-app__bar">
        <div className="st-app__brand">
          <span className="st-app__mark">✎</span>
          <div>
            <h1 className="st-app__name">StrokeTutor Web</h1>
            <p className="st-app__tagline">Author and test draw-along tutorials</p>
          </div>
        </div>
        <button
          type="button"
          className={`st-button ${debugOpen ? 'st-button--on' : ''}`}
          onClick={() => setDebugOpen((open) => !open)}
          aria-pressed={debugOpen}
        >
          {debugOpen ? 'Hide debug' : 'Show debug'}
        </button>
      </header>

      <main className={`st-app__main ${debugOpen ? 'is-debugging' : ''}`}>
        <TutorialSource
          onLoadText={handleLoadText}
          activeLabel={loaded.label}
          issues={issues}
          failedLabel={failedLabel}
        />

        <div className="st-app__stage">
          <TutorialPlayer key={loaded.generation} tutorial={loaded.tutorial} />
        </div>

        {debugOpen ? (
          <DebugPanel tutorial={loaded.tutorial} onClose={() => setDebugOpen(false)} />
        ) : null}
      </main>
    </div>
  )
}
