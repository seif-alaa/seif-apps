import type { SVGProps } from 'react';

/**
 * Original icon set drawn on a 24px grid with 1.75px rounded strokes.
 * Kept in one file so the visual language stays consistent.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.5 19c.6-3 2.8-4.75 5.5-4.75S13.9 16 14.5 19" />
    <path d="M15.5 5.6a3.1 3.1 0 0 1 0 5.8M17.5 14.6c1.6.6 2.6 2.1 3 4.4" />
  </Svg>
);
export const IconEnter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M4 12h11M11 8l4 4-4 4" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 5.5v-.25A1.75 1.75 0 0 0 13.75 3.5h-8.5A1.75 1.75 0 0 0 3.5 5.25v8.5c0 .97.78 1.75 1.75 1.75h.25" />
  </Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 14.5V3.5M8 7l4-4 4 4" />
    <path d="M6.5 11H5.75A1.75 1.75 0 0 0 4 12.75v6.5c0 .97.78 1.75 1.75 1.75h12.5c.97 0 1.75-.78 1.75-1.75v-6.5c0-.97-.78-1.75-1.75-1.75h-.75" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconCrown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17.5L3 8l5 4 4-6.5 4 6.5 5-4-1 9.5z" />
    <path d="M5 20.5h14" />
  </Svg>
);
export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2.5L5 13.5h6.5L10.5 21.5 19 10h-6.5z" />
  </Svg>
);
export const IconWave = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12h4l2.5-6 4 12 2.5-6h6" />
  </Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconOffline = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16a5 5 0 0 1 7 0M5.5 12.5a9.5 9.5 0 0 1 4-2.3M14.5 10.2a9.5 9.5 0 0 1 4 2.3M2.5 9a14 14 0 0 1 4.3-2.8M11 5.3a14 14 0 0 1 10.5 3.7" />
    <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
  </Svg>
);
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </Svg>
);
export const IconVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const IconMute = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15V15h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
  </Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
    <path d="M12 6.5v13" />
  </Svg>
);
export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" strokeDasharray="2 2" />
  </Svg>
);
export const IconSwap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9h12.5M14 5.5L17.5 9 14 12.5" />
    <path d="M19 15H6.5M10 11.5L6.5 15l3.5 3.5" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 16l5-5 4.5 4.5 2.5-2.5 5 5" />
    <circle cx="15.5" cy="9" r="1.5" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 5.5L16 12l-6.5 6.5" />
  </Svg>
);
export const IconExpand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L13.5 10.5M4.5 19.5l6-6" />
  </Svg>
);

/** Brand mark: an L of cored tiles with a detached tile, crossed by a pulse trace. */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lm-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6BE6CF" />
          <stop offset="1" stopColor="#1DB99C" />
        </linearGradient>
        <linearGradient id="lm-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF9670" />
          <stop offset="1" stopColor="#E9552A" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0C1017" stroke="#243042" strokeWidth="1.5" />
      {[
        [12, 12],
        [12, 27],
        [27, 27],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="13" height="13" rx="3" fill="url(#lm-a)" />
          <rect x={x! + 4} y={y! + 4} width="5" height="5" rx="1.2" fill="#9AF2E2" opacity="0.8" />
        </g>
      ))}
      <rect x="39" y="12" width="13" height="13" rx="3" fill="url(#lm-b)" />
      <rect x="43" y="16" width="5" height="5" rx="1.2" fill="#FFC3A8" opacity="0.85" />
      <path d="M8 49h12l4-7 5 12 4-9 3 4h20" fill="none" stroke="#3DE0D0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
