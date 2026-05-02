import type { CSSProperties } from 'react'

// Minimal icon set — replaces unicode glyphs (↑ ↶ ↷ ←) with consistent SVG
// strokes that scale crisply at any size. Sized 16 by default; larger keys
// (e.g. onboarding upload mark) accept a custom `size`.

export type IconName =
  | 'undo'
  | 'redo'
  | 'upload'
  | 'arrow-left'

type Props = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 16, className, style }: Props) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths(name)}
    </svg>
  )
}

function paths(name: IconName) {
  switch (name) {
    case 'undo':
      return (
        <>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h11a5 5 0 010 10h-3" />
        </>
      )
    case 'redo':
      return (
        <>
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H9a5 5 0 000 10h3" />
        </>
      )
    case 'upload':
      return (
        <>
          <path d="M12 4v12" />
          <path d="M6 10l6-6 6 6" />
          <path d="M4 20h16" />
        </>
      )
    case 'arrow-left':
      return (
        <>
          <path d="M15 19l-7-7 7-7" />
          <path d="M4 12h16" />
        </>
      )
  }
}
