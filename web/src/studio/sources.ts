/** A file's text and, when read through the Studio server, its version on disk. */
export interface SourceFile {
  text: string
  etag?: string
}

/** The raw files a `Library` is built from. */
export interface LibrarySources {
  tutorials: (SourceFile & { fileName: string })[]
  paths: SourceFile | null
  lessons: SourceFile | null
  references: { file: string; url: string }[]
  /** True when the Studio's local server is running, so saving is possible. */
  writable: boolean
}

/**
 * Reads `shared/` through the Studio server when it is running, straight from
 * disk. Only without a server (a static build) does it fall back to the copy
 * bundled at build time, which is read-only.
 *
 * Reading through the server, rather than importing the files, also keeps them
 * out of Vite's module graph: saving a lesson does not reload the page under
 * the creator.
 */
export async function loadSources(): Promise<LibrarySources> {
  try {
    const response = await fetch('/api/library', { headers: { Accept: 'application/json' } })
    const type = response.headers.get('content-type') ?? ''
    if (response.ok && type.includes('application/json')) {
      const snapshot = (await response.json()) as Omit<LibrarySources, 'writable'>
      return { ...snapshot, writable: true }
    }
  } catch {
    // No server; fall through to the bundled copy.
  }
  const { bundledSources } = await import('./bundledSources')
  return bundledSources()
}
