const MODEL_KEY = 'stroketutor:model'

/**
 * The creator's chosen generation model. A per-browser preference, so it lives
 * in localStorage; storage can be unavailable (private windows, blocked site
 * data), in which case the server's OPENROUTER_MODEL default applies.
 */
export function storedModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function storeModel(model: string) {
  try {
    if (model) localStorage.setItem(MODEL_KEY, model)
    else localStorage.removeItem(MODEL_KEY)
  } catch {
    // Not persisted; the choice still applies until the page reloads.
  }
}
