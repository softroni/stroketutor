/**
 * What makes an SVG safe to keep as a reference, and to trace in the Studio.
 *
 * Shared by the repository writer (which refuses to store an unsafe SVG) and
 * the browser (which checks before mounting one to trace it), so the two can
 * never disagree about what counts as "a plain drawing".
 */

/**
 * SVG has no magic number: it is UTF-8 text whose first element is `<svg>`,
 * after an optional byte-order mark, XML declaration, comments and a DOCTYPE.
 * A DOCTYPE with an internal subset is recognised here so that `svgProblem`
 * can refuse it with a reason: entity declarations are never needed for a
 * drawing, and are how XML bombs are built.
 */
export function isSvgDocument(bytes: Uint8Array): boolean {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096))
  } catch {
    // A multi-byte character cut at 4096 bytes is not a reason to refuse.
    if (bytes.length <= 4096) return false
    text = new TextDecoder().decode(bytes.subarray(0, 4096))
  }
  const prolog = /^\uFEFF?\s*(<\?xml[^>]*\?>\s*)?((<!--[\s\S]*?-->|<!DOCTYPE\s+svg[^[>]*(\[[\s\S]*?\]\s*)?>)\s*)*<svg[\s>/]/i
  return prolog.test(text)
}

/**
 * Why an SVG may not be kept or traced, or null. A reference is a picture to
 * look at; anything that runs code or pulls in other files is refused with a
 * reason the creator can act on. (Displayed through `<img>`, none of it would
 * run anyway, and the server's response headers cover the file opened on its
 * own; tracing mounts the SVG in the page, which is why the browser checks too.)
 */
export function svgProblem(text: string): string | null {
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) {
    return 'it declares XML entities. Export it again without a DOCTYPE.'
  }
  if (/<script[\s>/]/i.test(text)) return 'it contains a script. Remove the <script> element.'
  if (/<foreignObject[\s>/]/i.test(text)) return 'it embeds HTML through <foreignObject>.'
  if (/<(iframe|embed|object)[\s>/]/i.test(text)) return 'it embeds another document.'
  const handler = /\son[a-z]+\s*=/i.exec(text)
  if (handler) return `it has an event-handler attribute (${handler[0].trim().replace(/=$/, '')}).`
  if (/javascript:/i.test(text)) return 'it contains a javascript: link.'
  if (/@import/i.test(text)) return 'its CSS imports another file.'
  for (const match of text.matchAll(/\b(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    const target = match[2].trim()
    if (!target.startsWith('#') && !/^data:image\/(png|jpeg|webp|gif);/i.test(target)) {
      return `it links to another file (${target.slice(0, 60)}), which would not load. Embed the image instead.`
    }
  }
  for (const match of text.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/gi)) {
    const target = match[2].trim()
    if (!target.startsWith('#') && !/^data:image\//i.test(target)) {
      return `its CSS loads another file (${target.slice(0, 60)}), which would not load.`
    }
  }
  return null
}
