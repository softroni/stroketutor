/**
 * SF Symbols the app's paywall uses, redrawn as SVG (there are no SF Symbols on the
 * web). The lock, check and close follow `i-lock`, `i-check` and `i-close` in
 * docs/ios-design/src/symbols.svg.html; the others are drawn on the same 24 x 24
 * grid. All take `currentColor`, and all are decoration: the text beside each one
 * carries the meaning, so every icon is hidden from assistive technology.
 */

type IconProps = { className?: string };

const svgProps = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
} as const;

/** lock.open.fill */
export const LockOpenIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="10" width="14" height="11" rx="2.5" fill="currentColor" />
    <path
      d="M13 10 V6.5 a4 4 0 0 1 8 0 V8.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  </svg>
);

/** bell.fill */
export const BellIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path
      d="M12 2.5a1.6 1.6 0 0 1 1.6 1.6v.45A6.2 6.2 0 0 1 18.2 10.6v4.1l1.9 2.45a1 1 0 0 1-.8 1.6H4.7a1 1 0 0 1-.8-1.6l1.9-2.45v-4.1A6.2 6.2 0 0 1 10.4 4.55V4.1A1.6 1.6 0 0 1 12 2.5ZM9.3 19.8h5.4a2.7 2.7 0 0 1-5.4 0Z"
      fill="currentColor"
    />
  </svg>
);

/** creditcard.fill */
export const CardIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path
      fillRule="evenodd"
      d="M5 4.5h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3ZM2 8.2v2.6h20V8.2H2Zm3.2 6.3a.9.9 0 0 0 0 1.8h3.6a.9.9 0 0 0 0-1.8H5.2Z"
      fill="currentColor"
    />
  </svg>
);

/** person.3.fill */
export const PeopleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 34 24" aria-hidden focusable={false} className={className}>
    <circle cx="6.5" cy="8.5" r="3.6" fill="currentColor" />
    <circle cx="27.5" cy="8.5" r="3.6" fill="currentColor" />
    <path d="M0.5 20.5c0-3.7 2.7-6.3 6-6.3 2 0 3.7.9 4.8 2.4-.6 1.2-.9 2.5-.9 3.9Z" fill="currentColor" />
    <path d="M33.5 20.5c0-3.7-2.7-6.3-6-6.3-2 0-3.7.9-4.8 2.4.6 1.2.9 2.5.9 3.9Z" fill="currentColor" />
    <circle cx="17" cy="7" r="4.4" fill="currentColor" />
    <path d="M9.6 21.5c0-4.6 3.3-7.8 7.4-7.8s7.4 3.2 7.4 7.8Z" fill="currentColor" />
  </svg>
);

/** checkmark (i-check) */
export const CheckIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path
      d="M5 12.5 L10 17.5 L19 7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** xmark (i-close) */
export const CloseIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
  </svg>
);

/** crown.fill */
export const CrownIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path d="M3 8.5 L8 12.5 L12 5 L16 12.5 L21 8.5 L19 18 H5 Z" fill="currentColor" strokeLinejoin="round" />
    <rect x="5" y="19" width="14" height="2.4" rx="1" fill="currentColor" />
  </svg>
);
