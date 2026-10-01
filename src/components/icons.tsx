// Small monochrome icons, drawn in currentColor so they follow the theme.

type IconProps = { className?: string };

/**
 * The bishop silhouette in a 100x100 box. The browser-tab and home-screen
 * icons (src/app/icon.svg, favicon.ico, apple-icon.png, public/icon-*.png)
 * use the same path; fill-rule evenodd cuts the mitre's slit out.
 */
export const BISHOP_PATH =
  "M50 7.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13Z" +
  "M50 22C61.5 31 69.5 42.5 65 53.5C63 58 58.5 60 50 60C41.5 60 37 58 35 53.5C30.5 42.5 38.5 31 50 22Z" +
  "M42.6 46.4L54.4 31.6L58 34.4L46.2 49.2Z" +
  "M34 63.5a3 3 0 0 1 3-3h26a3 3 0 0 1 0 6h-26a3 3 0 0 1-3-3Z" +
  "M41.5 68.5h17l3.5 11h-24Z" +
  "M27 93c0-5.5 4.5-10 10-10h26c5.5 0 10 4.5 10 10Z";

export function BishopIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <path fill="currentColor" fillRule="evenodd" d={BISHOP_PATH} />
    </svg>
  );
}

export function TrophyIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2.4" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2.4" />
      <path d="M12 14v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function StarIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9L12 3.5Z"
      />
    </svg>
  );
}
