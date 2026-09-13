/**
 * Lina, the tutor the app speaks with. The paths are the `lina-neutral` symbol
 * from `docs/ios-design/src/symbols.svg.html`, copied rather than linked so the
 * Studio does not depend on the design mock-ups being present.
 *
 * She appears twice on this page: once beside the title, at reading size, and
 * once, small, on the card of the voice cast as her.
 */
export function LinaPortrait({ size = 72, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="st-lina"
      width={size}
      height={size * 1.2}
      viewBox="0 0 200 240"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d="M62 236 C62 182 84 164 100 164 C116 164 138 182 138 236 Z" fill="#C4653A" />
      <path d="M88 142 h24 v30 a12 12 0 0 1 -24 0 z" fill="#EFC9AE" />
      <path d="M50 122 C42 60 70 30 100 30 C130 30 158 60 150 122 L148 156 L52 156 Z" fill="#2B2B2B" />
      <ellipse cx="100" cy="102" rx="42" ry="48" fill="#EFC9AE" />
      <path
        d="M57 94 C60 52 88 40 114 46 C136 51 148 72 146 94 C130 80 118 72 100 76 C84 79 70 84 57 94 Z"
        fill="#2B2B2B"
      />
      <path d="M46 66 C52 28 150 20 160 60 C132 44 76 46 46 66 Z" fill="#2178D9" />
      <circle cx="82" cy="106" r="13" fill="none" stroke="#2B2B2B" strokeWidth="3" />
      <circle cx="118" cy="106" r="13" fill="none" stroke="#2B2B2B" strokeWidth="3" />
      <path d="M95 106 L105 106" stroke="#2B2B2B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="83" cy="107" r="3.2" fill="#2B2B2B" />
      <circle cx="119" cy="107" r="3.2" fill="#2B2B2B" />
      <path d="M88 130 Q100 140 112 130" fill="none" stroke="#2B2B2B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="70" cy="124" r="5" fill="#E9A28E" opacity=".6" />
      <circle cx="130" cy="124" r="5" fill="#E9A28E" opacity=".6" />
    </svg>
  )
}
