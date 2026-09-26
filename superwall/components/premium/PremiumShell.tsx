import * as React from "react";
import type { PropsWithChildren } from "react";
import { useDevice } from "superwall/hooks";
import "./theme.css";

/**
 * The layout both Premium paywalls share: the flex shell the framework's content
 * box expects, and the learner's text size.
 *
 * Every size in theme.css is rem, so the root font size is the one dial. The iOS
 * SDK reports the system text size as `fontScale` (UIFontMetrics' body scale, 1 at
 * the default size). Like the app's ScaledFont, the scale never goes below 1 and is
 * capped, here at 1.4 so the pinned footer still leaves room on an iPhone SE; the
 * price, the free week and the button title all scale together, so the billed
 * amount stays the largest text at every size.
 */
const MIN_SCALE = 1;
const MAX_SCALE = 1.4;

const typeScale = (fontScale: unknown): number => {
  const value = Number(fontScale);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
};

export function PremiumShell({ children }: PropsWithChildren) {
  const { fontScale } = useDevice();
  const scale = typeScale(fontScale);

  React.useLayoutEffect(() => {
    const style = document.documentElement.style;
    if (scale === 1) style.removeProperty("font-size");
    else style.setProperty("font-size", `${16 * scale}px`);
  }, [scale]);

  return <div className="pc-shell">{children}</div>;
}
