import type { CSSProperties } from 'react'

/**
 * Shared empty-state SVG illustrations for Attestations, Revenue Sources, and
 * Exports pages. Each illustration is token-driven (uses CSS custom properties
 * for fills) so it adapts to light/dark theme automatically.
 *
 * Usage:
 *   <EmptyStateIllustrations.Illustration type="attestations" />
 *
 * All SVGs are aria-hidden="true" with a companion <p> providing the
 * accessible description below the illustration.
 */

/* ─── Shared viewBox & sizing ──────────────────────────────────────────── */

const SIZES = { width: 200, height: 160 } as const

const wrapperStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '1.5rem 0 0.5rem',
}

/* ─── Attestations (certificate / shield with a check) ─────────────────── */

function AttestationsSvg() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={SIZES.width}
      height={SIZES.height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background ring */}
      <circle
        cx="100"
        cy="80"
        r="58"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      {/* Inner glow circle */}
      <circle
        cx="100"
        cy="80"
        r="42"
        fill="var(--accent)"
        opacity="0.06"
      />
      {/* Shield body */}
      <path
        d="M100 44 L128 56 L128 88 C128 108 100 120 100 120 C100 120 72 108 72 88 L72 56 Z"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--accent)"
        fillOpacity="0.08"
      />
      {/* Checkmark inside shield */}
      <path
        d="M88 82 L97 91 L113 73"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Decorative dots */}
      <circle cx="74" cy="52" r="2.5" fill="var(--accent)" opacity="0.3" />
      <circle cx="126" cy="52" r="2.5" fill="var(--accent)" opacity="0.3" />
      <circle cx="100" cy="128" r="2" fill="var(--muted)" opacity="0.2" />
    </svg>
  )
}

/* ─── Revenue Sources (plug / connection) ──────────────────────────────── */

function RevenueSourcesSvg() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={SIZES.width}
      height={SIZES.height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background ring */}
      <circle
        cx="100"
        cy="80"
        r="58"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      {/* Inner glow circle */}
      <circle
        cx="100"
        cy="80"
        r="42"
        fill="var(--accent)"
        opacity="0.06"
      />
      {/* Plug body */}
      <rect
        x="88"
        y="52"
        width="24"
        height="32"
        rx="4"
        stroke="var(--accent)"
        strokeWidth="2"
        fill="var(--accent)"
        fillOpacity="0.08"
      />
      {/* Plug prongs (top) */}
      <rect x="92" y="46" width="4" height="10" rx="1" fill="var(--accent)" opacity="0.6" />
      <rect x="104" y="46" width="4" height="10" rx="1" fill="var(--accent)" opacity="0.6" />
      {/* Cable (bottom) */}
      <path
        d="M100 84 L100 98"
        stroke="var(--muted)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Cable wave */}
      <path
        d="M100 98 C100 102 88 104 88 110 C88 116 112 114 112 120"
        stroke="var(--muted)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* Port outline (socket) */}
      <rect
        x="82"
        y="72"
        width="36"
        height="10"
        rx="3"
        stroke="var(--accent)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.3"
      />
      {/* Decorative dots */}
      <circle cx="64" cy="66" r="2.5" fill="var(--accent)" opacity="0.25" />
      <circle cx="136" cy="66" r="2.5" fill="var(--accent)" opacity="0.25" />
    </svg>
  )
}

/* ─── Data Export (download arrow / file tray) ─────────────────────────── */

function DataExportSvg() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={SIZES.width}
      height={SIZES.height}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background ring */}
      <circle
        cx="100"
        cy="80"
        r="58"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      {/* Inner glow circle */}
      <circle
        cx="100"
        cy="80"
        r="42"
        fill="var(--accent)"
        opacity="0.06"
      />
      {/* Document body */}
      <rect
        x="80"
        y="48"
        width="40"
        height="52"
        rx="4"
        stroke="var(--accent)"
        strokeWidth="2"
        fill="var(--accent)"
        fillOpacity="0.08"
      />
      {/* Document lines (content) */}
      <rect x="88" y="58" width="24" height="3" rx="1.5" fill="var(--muted)" opacity="0.3" />
      <rect x="88" y="66" width="18" height="3" rx="1.5" fill="var(--muted)" opacity="0.25" />
      <rect x="88" y="74" width="20" height="3" rx="1.5" fill="var(--muted)" opacity="0.2" />
      {/* Download arrow */}
      <path
        d="M100 88 L100 74 M94 82 L100 88 L106 82"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tray below */}
      <path
        d="M78 106 L84 106 C84 106 88 112 100 112 C112 112 116 106 116 106 L122 106"
        stroke="var(--muted)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Decorative dots */}
      <circle cx="72" cy="58" r="2.5" fill="var(--accent)" opacity="0.25" />
      <circle cx="128" cy="58" r="2.5" fill="var(--accent)" opacity="0.25" />
    </svg>
  )
}

/* ─── Public API ───────────────────────────────────────────────────────── */

export type IllustrationType = 'attestations' | 'revenue-sources' | 'data-export'

export const ILLUSTRATION_META: Record<
  IllustrationType,
  { label: string; description: string }
> = {
  attestations: {
    label: 'No attestations illustration',
    description:
      'A shield with a checkmark, representing verified attestations that appear once revenue reports are published.',
  },
  'revenue-sources': {
    label: 'No sources illustration',
    description:
      'A plug and cable, representing revenue source integrations that can be connected from the dashboard.',
  },
  'data-export': {
    label: 'No exports illustration',
    description:
      'A document with a download arrow, representing export files that appear once generated.',
  },
}

interface EmptyStateIllustrationProps {
  type: IllustrationType
}

export function EmptyStateIllustration({ type }: EmptyStateIllustrationProps) {
  if (!Object.prototype.hasOwnProperty.call(ILLUSTRATION_META, type)) {
    throw new RangeError(`Unknown empty-state illustration type: ${String(type)}`)
  }

  const meta = ILLUSTRATION_META[type]

  const SvgMap: Record<IllustrationType, () => JSX.Element> = {
    attestations: AttestationsSvg,
    'revenue-sources': RevenueSourcesSvg,
    'data-export': DataExportSvg,
  }

  const SvgComponent = SvgMap[type]

  return (
    <div style={wrapperStyle} role="presentation">
      <SvgComponent />
      <span className="sr-only">{meta.description}</span>
    </div>
  )
}

export const EmptyStateIllustrations = {
  Illustration: EmptyStateIllustration,
  Meta: ILLUSTRATION_META,
}
