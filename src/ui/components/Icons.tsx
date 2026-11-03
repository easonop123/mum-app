// Simple original line icons (decorative; always paired with text).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 28, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The app mark: one small dot above a steady line — "a little" (一点). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#1b6158" />
      <circle cx="20.5" cy="11" r="3.2" fill="#faf7f2" />
      <rect x="7" y="18.5" width="18" height="3.6" rx="1.8" fill="#faf7f2" />
    </svg>
  );
}

export const ChairIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 4v14M10 18h13v10M10 18v10M10 11h11" />
    <path d="M23 18V9" />
  </Svg>
);
export const WallIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 5h22v22H5z" />
    <path d="M5 12h22M5 19h22M12 5v7M20 12v7M12 19v8" />
  </Svg>
);
export const CounterIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 12h26M6 12v15M26 12v15M6 19h20" />
  </Svg>
);
export const ShoeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 22c0-5 2-11 6-12l4 5 9 3c3 1 5 3 5 5v2H4z" />
    <path d="M4 25h24" />
  </Svg>
);
export const PhoneIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="14" height="26" rx="3" />
    <path d="M14 25h4" />
  </Svg>
);
export const BreathIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15a4 4 0 1 0-4-4M4 18h20a4 4 0 1 1-4 4M4 24h9" />
  </Svg>
);
export const FloorIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 24h26M7 24l4-8h10l4 8" />
  </Svg>
);
export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="16" cy="16" r="12" />
    <path d="M13 11l8 5-8 5z" fill="currentColor" />
  </Svg>
);
export const ExternalIcon = (p: P) => (
  <Svg {...p}>
    <path d="M18 5h9v9M27 5L14 18M24 19v7H6V8h7" />
  </Svg>
);
export const AlertIcon = (p: P) => (
  <Svg {...p}>
    <path d="M16 4l13 23H3z" />
    <path d="M16 13v6M16 23v.5" />
  </Svg>
);
export const PauseIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="16" cy="16" r="12" />
    <path d="M13 11v10M19 11v10" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 17l6 6L26 9" />
  </Svg>
);
export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="16" cy="16" r="12" />
    <path d="M16 15v8M16 10v.5" />
  </Svg>
);
export const PhoneCallIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 4h5l2 7-3 2a16 16 0 0 0 7 7l2-3 7 2v5a3 3 0 0 1-3 3A22 22 0 0 1 5 7a3 3 0 0 1 3-3z" />
  </Svg>
);
export const SpeakerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h5l7-6v20l-7-6H5z" />
    <path d="M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" />
  </Svg>
);
