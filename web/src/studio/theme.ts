import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Also read by the inline script in index.html, which sets the theme before the first paint. */
export const THEME_KEY = 'papercoach:theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * The creator's chosen theme, or null while they have not chosen one and the
 * Studio follows the system. A per-browser preference, so it lives in
 * localStorage; storage can be unavailable (private windows, blocked site data),
 * in which case the system's theme applies.
 */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Not persisted; the choice still applies until the page reloads.
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/**
 * The theme in use, and a toggle that switches to the other one and remembers
 * it. Until the creator toggles, the Studio follows the system, live.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  useEffect(() => applyTheme(theme), [theme])

  // The system changing while nothing is chosen, or a choice made in another Studio tab.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const follow = () => setTheme(storedTheme() ?? systemTheme())
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) follow()
    }
    query.addEventListener('change', follow)
    window.addEventListener('storage', onStorage)
    return () => {
      query.removeEventListener('change', follow)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setTheme(next)
  }, [theme])

  return [theme, toggle]
}
