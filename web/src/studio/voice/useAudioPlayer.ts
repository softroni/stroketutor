import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { takeAudioUrl } from '../api'

export interface AudioPlayer {
  /** The take sounding right now, or null. */
  playingTakeId: string | null
  /** The last take played, so the space bar has something to toggle. */
  lastTakeId: string | null
  /** How far through the playing take, 0 to 1, for the thin line under its row. */
  progress: number
  /** Why the browser could not play it, if it could not. */
  error: string | null
  toggle(takeId: string): void
  play(takeId: string): void
  stop(): void
}

/**
 * One `<audio>` element for the whole page, so two takes can never talk over
 * each other: starting one stops whatever was playing.
 *
 * The space bar toggles the last take played and Escape stops, but only while
 * the creator is not typing — on this page there are text fields everywhere,
 * and a space bar that stole a word would be unforgivable.
 */
export function useAudioPlayer(): AudioPlayer {
  const element = useRef<HTMLAudioElement | null>(null)
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null)
  const [lastTakeId, setLastTakeId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const audio = useCallback(() => {
    element.current ??= new Audio()
    return element.current
  }, [])

  useEffect(() => {
    const sound = audio()
    const onTime = () => setProgress(sound.duration > 0 ? sound.currentTime / sound.duration : 0)
    const onEnded = () => {
      setPlayingTakeId(null)
      setProgress(0)
    }
    sound.addEventListener('timeupdate', onTime)
    sound.addEventListener('ended', onEnded)
    return () => {
      sound.removeEventListener('timeupdate', onTime)
      sound.removeEventListener('ended', onEnded)
      sound.pause()
    }
  }, [audio])

  const stop = useCallback(() => {
    const sound = audio()
    sound.pause()
    setPlayingTakeId(null)
    setProgress(0)
  }, [audio])

  const play = useCallback(
    (takeId: string) => {
      const sound = audio()
      setError(null)
      setLastTakeId(takeId)
      const url = takeAudioUrl(takeId)
      if (sound.src !== url) sound.src = url
      sound.currentTime = 0
      setProgress(0)
      setPlayingTakeId(takeId)
      void sound.play().catch((caught: unknown) => {
        setPlayingTakeId(null)
        setError(caught instanceof Error ? caught.message : 'That take would not play.')
      })
    },
    [audio],
  )

  const toggle = useCallback(
    (takeId: string) => {
      if (playingTakeId === takeId) stop()
      else play(takeId)
    },
    [play, playingTakeId, stop],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (event.key === 'Escape') {
        if (playingTakeId) stop()
        return
      }
      if (event.key !== ' ' || typing) return
      // A focused button already answers the space bar; let it.
      if (target instanceof HTMLElement && target.closest('button, a[href]')) return
      if (!lastTakeId) return
      event.preventDefault()
      toggle(lastTakeId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lastTakeId, playingTakeId, stop, toggle])

  return useMemo(
    () => ({ playingTakeId, lastTakeId, progress, error, toggle, play, stop }),
    [error, lastTakeId, play, playingTakeId, progress, stop, toggle],
  )
}
