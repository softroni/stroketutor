import { PATH_SWATCHES, type PathColor } from '../catalog/pathColors'

/** A small round sample of a path's color, beside its name. */
export function PathColorDot({ color }: { color: PathColor }) {
  return <span className="st-path-dot" style={{ background: PATH_SWATCHES[color].deep }} aria-hidden="true" />
}
