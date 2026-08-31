import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineStepStatus = 'completed' | 'current' | 'pending' | 'failed'

export type AttestationLifecycleStage = 'submitted' | 'queued' | 'verifying' | 'anchored' | 'finalized'

export interface TimelineStep {
  id: AttestationLifecycleStage
  label: string
  description: string
  timestamp?: string
  status: TimelineStepStatus
}

// ---------------------------------------------------------------------------
// Timeline metadata with accessible iconography and colors
// ---------------------------------------------------------------------------

const STEP_META: Record<
  AttestationLifecycleStage,
  { icon: string; ariaLabel: string }
> = {
  submitted: {
    icon: '📤',
    ariaLabel: 'Submitted',
  },
  queued: {
    icon: '⏳',
    ariaLabel: 'Queued',
  },
  verifying: {
    icon: '🔍',
    ariaLabel: 'Verifying',
  },
  anchored: {
    icon: '⚓',
    ariaLabel: 'Anchored',
  },
  finalized: {
    icon: '✅',
    ariaLabel: 'Finalized',
  },
}

const STATUS_META: Record<
  TimelineStepStatus,
  { 
    bg: string
    border: string
    icon: string
    textColor: string
    ariaLabel: string
  }
> = {
  completed: {
    bg: 'var(--success-soft)',
    border: 'var(--success)',
    icon: '✓',
    textColor: 'var(--success)',
    ariaLabel: 'Completed',
  },
  current: {
    bg: 'rgba(94,234,212,0.12)',
    border: 'var(--accent)',
    icon: '●',
    textColor: 'var(--accent)',
    ariaLabel: 'In progress',
  },
  pending: {
    bg: 'rgba(148,163,184,0.08)',
    border: 'var(--border)',
    icon: '○',
    textColor: 'var(--muted)',
    ariaLabel: 'Pending',
  },
  failed: {
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
    icon: '✕',
    textColor: 'var(--danger)',
    ariaLabel: 'Failed',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return ''
  
  const now = new Date()
  const timestamp = new Date(isoTimestamp)
  const diffMs = now.getTime() - timestamp.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return timestamp.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatAbsoluteTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return ''
  
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// TimelineStepNode - Individual step component
// ---------------------------------------------------------------------------

interface TimelineStepNodeProps {
  step: TimelineStep
  index: number
  isLast: boolean
  showTimestamps: boolean
}

function TimelineStepNode({ step, index, isLast, showTimestamps }: TimelineStepNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const meta = STEP_META[step.id]
  const statusMeta = STATUS_META[step.status]
  const isCurrent = step.status === 'current'

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '1rem',
        position: 'relative',
      }}
      role="listitem"
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Timeline connector line */}
      <div
        style={{
          position: 'absolute',
          left: '1.25rem',
          top: '2.5rem',
          bottom: isLast ? 'auto' : '-1rem',
          width: '2px',
          background: step.status === 'completed' 
            ? 'var(--success)' 
            : step.status === 'failed'
              ? 'var(--danger)'
              : 'var(--border)',
          opacity: step.status === 'pending' ? 0.3 : 1,
        }}
        aria-hidden="true"
      />

      {/* Step icon/node */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          background: statusMeta.bg,
          border: `2px solid ${statusMeta.border}`,
          color: statusMeta.textColor,
          fontSize: '1rem',
          fontWeight: 700,
          transition: 'all var(--motion-duration-sm) var(--motion-easing-standard)',
          flexShrink: 0,
        }}
        aria-label={`${meta.ariaLabel} - ${statusMeta.ariaLabel}`}
      >
        {step.status === 'completed' ? (
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 14 14" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="2,7 5,10 12,3" />
          </svg>
        ) : step.status === 'failed' ? (
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 14 14" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        ) : step.status === 'current' ? (
          <span 
            style={{
              display: 'inline-block',
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: 'currentColor',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
            aria-hidden="true"
          />
        ) : (
          <span aria-hidden="true">{statusMeta.icon}</span>
        )}
      </div>

      {/* Step content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          paddingBottom: isLast ? '0' : '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: step.status === 'pending' ? 'var(--muted)' : 'var(--text)',
            }}
          >
            {step.label}
          </h3>
          {step.status === 'current' && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'rgba(94,234,212,0.12)',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              In progress
            </span>
          )}
          {step.status === 'failed' && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--danger)',
                background: 'var(--danger-soft)',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Failed
            </span>
          )}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          {step.description}
        </p>

        {showTimestamps && step.timestamp && (
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <time
              dateTime={step.timestamp}
              style={{
                fontSize: '0.78rem',
                color: 'var(--muted)',
                cursor: 'help',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textDecorationColor: 'var(--border)',
              }}
            >
              {formatRelativeTime(step.timestamp)}
            </time>
            
            {showTooltip && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.25rem',
                  padding: '0.4rem 0.6rem',
                  background: 'var(--surface-strong)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {formatAbsoluteTime(step.timestamp)}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// StatusTimeline - Main component
// ---------------------------------------------------------------------------

interface StatusTimelineProps {
  steps: TimelineStep[]
  showTimestamps?: boolean
  ariaLabel?: string
}

const defaultAriaLabel = 'Attestation lifecycle timeline'

export default function StatusTimeline({ 
  steps, 
  showTimestamps = true,
  ariaLabel = defaultAriaLabel 
}: StatusTimelineProps) {
  if (steps.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '0.9rem',
        }}
      >
        No timeline steps available.
      </div>
    )
  }

  return (
    <section aria-label={ariaLabel}>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {steps.map((step, index) => (
          <TimelineStepNode
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            showTimestamps={showTimestamps}
          />
        ))}
      </ol>

      {/* Pulse animation for current step */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 1;
            }
          }
        }
      `}</style>
    </section>
  )
}
