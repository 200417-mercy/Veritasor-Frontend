import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ResultAnimation from './ResultAnimation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AttestationPhase = 'idle' | 'running' | 'complete' | 'canceled'
type StepStatus = 'completed' | 'active' | 'pending'
type EventType = 'created' | 'verified' | 'failed' | 'retried'
type Actor = 'system' | 'user' | 'integration'

interface StepEvent {
  title: string
  detail: string
  actor: Actor
  eventType: EventType
  payloadSnippet: string
  /** Duration in ms — only present once step is complete */
  durationMs?: number
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const ATTESTATION_STEPS: StepEvent[] = [
  {
    title: 'Collecting monthly revenue',
    detail:
      'Pull monthly totals from connected payment sources and normalize values for proof generation.',
    actor: 'integration',
    eventType: 'created',
    payloadSnippet: '{"sources":["stripe","shopify","razorpay"],"period":"2026-05"}',
    durationMs: 820,
  },
  {
    title: 'Verifying input sources',
    detail:
      'Confirm that Stripe, Razorpay, and Shopify sources are complete and consistent.',
    actor: 'system',
    eventType: 'verified',
    payloadSnippet: '{"verified":3,"warnings":0,"skipped":0}',
    durationMs: 540,
  },
  {
    title: 'Building merkle root',
    detail:
      'Construct the transaction proof and prepare the attestation record for Stellar.',
    actor: 'system',
    eventType: 'created',
    payloadSnippet: '{"root":"0xabc1…ef89","leafCount":312,"depth":9}',
    durationMs: 1100,
  },
  {
    title: 'Publishing attestation to Stellar',
    detail:
      'Submit the final attestation and metadata to the blockchain for auditability.',
    actor: 'user',
    eventType: 'verified',
    payloadSnippet: '{"txHash":"0xd4f2…b81c","network":"testnet","slot":4419872}',
    durationMs: 970,
  },
]

const EVENT_TYPE_OPTIONS: { value: EventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'created', label: 'Created' },
  { value: 'verified', label: 'Verified' },
  { value: 'failed', label: 'Failed' },
  { value: 'retried', label: 'Retried' },
]

const ACTOR_OPTIONS: { value: Actor | 'all'; label: string }[] = [
  { value: 'all', label: 'All actors' },
  { value: 'system', label: 'System' },
  { value: 'user', label: 'User' },
  { value: 'integration', label: 'Integration' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStepStatus(
  index: number,
  activeStep: number,
  phase: AttestationPhase,
): StepStatus {
  if (phase === 'complete') return 'completed'
  if (index + 1 < activeStep) return 'completed'
  if (index + 1 === activeStep && phase === 'running') return 'active'
  return 'pending'
}

function getStatusLabel(phase: AttestationPhase, activeStep: number) {
  if (phase === 'running') return `Step ${activeStep} of ${ATTESTATION_STEPS.length}`
  if (phase === 'complete') return 'Attestation complete'
  if (phase === 'canceled') return 'Attestation canceled'
  return 'Ready to begin attestation processing'
}

function getStatusTone(phase: AttestationPhase) {
  if (phase === 'complete') return 'var(--success)'
  if (phase === 'canceled') return 'var(--danger)'
  return 'var(--accent)'
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

// ---------------------------------------------------------------------------
// Filter helpers (URL query params)
// ---------------------------------------------------------------------------

function useTimelineFilters() {
  const location = useLocation()
  const navigate = useNavigate()

  const params = new URLSearchParams(location.search)
  const eventTypeFilter = (params.get('eventType') ?? 'all') as EventType | 'all'
  const actorFilter = (params.get('actor') ?? 'all') as Actor | 'all'

  function setEventTypeFilter(value: EventType | 'all') {
    const next = new URLSearchParams(location.search)
    if (value === 'all') next.delete('eventType')
    else next.set('eventType', value)
    navigate({ search: next.toString() }, { replace: true })
  }

  function setActorFilter(value: Actor | 'all') {
    const next = new URLSearchParams(location.search)
    if (value === 'all') next.delete('actor')
    else next.set('actor', value)
    navigate({ search: next.toString() }, { replace: true })
  }

  /**
   * Clear *both* filters in a single navigation. Doing this with two
   * sequential `navigate` calls would lose one of the updates, because each
   * setter rebuilds the query string from the `location.search` captured by
   * the current render (the second call would still see the first filter).
   */
  function clearFilters() {
    const next = new URLSearchParams(location.search)
    next.delete('eventType')
    next.delete('actor')
    navigate({ search: next.toString() }, { replace: true })
  }

  return { eventTypeFilter, actorFilter, setEventTypeFilter, setActorFilter, clearFilters }
}

// ---------------------------------------------------------------------------
// FilterRow — #219
// ---------------------------------------------------------------------------

interface FilterRowProps {
  eventTypeFilter: EventType | 'all'
  actorFilter: Actor | 'all'
  onEventTypeChange: (v: EventType | 'all') => void
  onActorChange: (v: Actor | 'all') => void
  onClear: () => void
  filteredCount: number
  totalCount: number
}

function FilterRow({
  eventTypeFilter,
  actorFilter,
  onEventTypeChange,
  onActorChange,
  onClear,
  filteredCount,
  totalCount,
}: FilterRowProps) {
  const hasActiveFilters = eventTypeFilter !== 'all' || actorFilter !== 'all'

  return (
    <div
      role="search"
      aria-label="Filter timeline events"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        background: 'rgba(148,163,184,0.05)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {/* Event type chips */}
      <div role="group" aria-label="Filter by event type" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
        {EVENT_TYPE_OPTIONS.map((opt) => {
          const active = eventTypeFilter === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onEventTypeChange(opt.value as EventType | 'all')}
              className={`sf-chip${active ? ' sf-chip-active' : ''}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <span aria-hidden="true" style={{ color: 'var(--border)', padding: '0 0.125rem', fontSize: '1.25rem', lineHeight: 1 }}>
        ·
      </span>

      {/* Actor chips */}
      <div role="group" aria-label="Filter by actor" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
        {ACTOR_OPTIONS.map((opt) => {
          const active = actorFilter === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onActorChange(opt.value as Actor | 'all')}
              className={`sf-chip${active ? ' sf-chip-active' : ''}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Clear all + result count */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {hasActiveFilters && (
          <button
            type="button"
            className="sf-clear-all"
            onClick={onClear}
          >
            Clear
          </button>
        )}
        {/* aria-live so filter changes are announced */}
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          {filteredCount === totalCount
            ? `${totalCount} event${totalCount !== 1 ? 's' : ''}`
            : `${filteredCount} of ${totalCount}`}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExpandableStep — #217
// ---------------------------------------------------------------------------

interface ExpandableStepProps {
  step: StepEvent
  stepStatus: StepStatus
  index: number
  defaultExpanded?: boolean
}

function ExpandableStep({ step, stepStatus, index, defaultExpanded = false }: ExpandableStepProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const panelId = useId()
  const triggerId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const isCurrent = stepStatus === 'active'

  const titleColor =
    stepStatus === 'completed'
      ? 'var(--success)'
      : isCurrent
        ? 'var(--accent)'
        : 'var(--muted)'

  const statusText =
    stepStatus === 'completed' ? 'Done' : isCurrent ? 'In progress' : 'Pending'

  // Smooth height animation
  const panelStyle: React.CSSProperties = {
    overflow: 'hidden',
    transition: 'max-height var(--motion-duration-md) var(--motion-easing-standard)',
    maxHeight: expanded ? '20rem' : '0',
  }

  return (
    <li
      aria-current={isCurrent ? 'step' : undefined}
      style={{
        borderRadius: 14,
        border: '1px solid var(--border)',
        background:
          stepStatus === 'completed'
            ? 'rgba(52,211,153,0.10)'
            : isCurrent
              ? 'rgba(94,234,212,0.06)'
              : 'transparent',
        overflow: 'hidden',
        transition: 'background var(--motion-duration-sm) ease',
      }}
    >
      {/* Header row — acts as the toggle trigger */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: titleColor, fontSize: '0.97rem' }}>
            {step.title}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{step.detail}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: titleColor,
            }}
          >
            {statusText}
          </span>

          {/* Step number badge */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.6rem',
              height: '1.6rem',
              borderRadius: '999px',
              background:
                stepStatus === 'completed'
                  ? 'rgba(52,211,153,0.18)'
                  : isCurrent
                    ? 'linear-gradient(135deg,var(--accent),#60a5fa)'
                    : 'rgba(148,163,184,0.16)',
              color:
                stepStatus === 'completed'
                  ? '#dcfff1'
                  : isCurrent
                    ? '#04111f'
                    : 'var(--muted)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {stepStatus === 'completed' ? '✓' : index + 1}
          </span>

          {/* Chevron */}
          <span
            aria-hidden="true"
            style={{
              fontSize: '0.6rem',
              color: 'var(--muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--motion-duration-sm) ease',
              display: 'inline-block',
            }}
          >
            ▼
          </span>
        </span>
      </button>

      {/* Expandable details panel */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        ref={panelRef}
        style={panelStyle}
      >
        <div
          style={{
            padding: '0 1rem 1rem',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <hr style={{ margin: 0, border: 'none', borderTop: '1px solid var(--border)' }} />

          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* Actor */}
            <div
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'rgba(148,163,184,0.05)',
              }}
            >
              <dt style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                Actor
              </dt>
              <dd style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', textTransform: 'capitalize' }}>
                {step.actor}
              </dd>
            </div>

            {/* Event type */}
            <div
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'rgba(148,163,184,0.05)',
              }}
            >
              <dt style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                Event type
              </dt>
              <dd style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', textTransform: 'capitalize' }}>
                {step.eventType}
              </dd>
            </div>

            {/* Duration */}
            {step.durationMs !== undefined && (
              <div
                style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'rgba(148,163,184,0.05)',
                }}
              >
                <dt style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                  Duration
                </dt>
                <dd style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                  {formatDuration(step.durationMs)}
                </dd>
              </div>
            )}
          </dl>

          {/* Payload snippet */}
          <div>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Payload snippet
            </p>
            <code
              style={{
                display: 'block',
                padding: '0.65rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'rgba(15,23,42,0.72)',
                fontFamily: '"SF Mono","Fira Code",monospace',
                fontSize: '0.78rem',
                color: 'var(--accent)',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
              }}
            >
              {step.payloadSnippet}
            </code>
          </div>
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// AttestationProgress (main export) — #217 + #219
// ---------------------------------------------------------------------------

interface AttestationProgressProps {
  stepDurationMs?: number
}

export default function AttestationProgress({ stepDurationMs = 1100 }: AttestationProgressProps) {
  const [phase, setPhase] = useState<AttestationPhase>('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [message, setMessage] = useState('Ready to generate a new revenue attestation.')
  const [wasCanceled, setWasCanceled] = useState(false)

  const { eventTypeFilter, actorFilter, setEventTypeFilter, setActorFilter, clearFilters } =
    useTimelineFilters()

  // Filter steps by active filters
  const filteredSteps = ATTESTATION_STEPS.filter((step) => {
    const matchEventType = eventTypeFilter === 'all' || step.eventType === eventTypeFilter
    const matchActor = actorFilter === 'all' || step.actor === actorFilter
    return matchEventType && matchActor
  })

  // Step advancement
  useEffect(() => {
    if (phase !== 'running' || activeStep === 0) return undefined

    const currentStep = ATTESTATION_STEPS[activeStep - 1]
    setMessage(`${currentStep.title} is in progress.`)

    if (activeStep === ATTESTATION_STEPS.length) {
      const t = setTimeout(() => {
        setPhase('complete')
        setMessage('Attestation successfully published on Stellar. You can start another report when needed.')
      }, stepDurationMs)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      if (wasCanceled) return
      setActiveStep((c) => Math.min(ATTESTATION_STEPS.length, c + 1))
    }, stepDurationMs)

    return () => clearTimeout(t)
  }, [activeStep, phase, wasCanceled, stepDurationMs])

  function startAttestation() {
    setWasCanceled(false)
    setPhase('running')
    setActiveStep(1)
    setMessage('Collecting monthly revenue to build a proof record.')
  }

  function cancelAttestation() {
    setPhase('canceled')
    setWasCanceled(true)
    setMessage('Attestation processing was canceled. Start again when you are ready.')
  }

  function resetAttestation() {
    setPhase('idle')
    setActiveStep(0)
    setWasCanceled(false)
    setMessage('Ready to generate a new revenue attestation.')
  }

  const actionLabel =
    phase === 'running'
      ? 'Cancel attestation'
      : phase === 'complete'
        ? 'Start another attestation'
        : 'Start attestation'
  const actionHandler = phase === 'running' ? cancelAttestation : startAttestation

  const exportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <section
      aria-labelledby="attestation-progress-label"
      data-export-date={exportDate}
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        display: 'grid',
        gap: '1.25rem',
      }}
    >
      {/* Header + actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between' }}>
        <div>
          <p
            id="attestation-progress-label"
            style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}
          >
            Attestation progress
          </p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)' }}>{message}</p>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', alignItems: 'start' }}>
          <p style={{ margin: 0, color: getStatusTone(phase), fontWeight: 700 }}>
            {getStatusLabel(phase, activeStep)}
          </p>
          <button
            type="button"
            onClick={actionHandler}
            style={{
              minWidth: 190,
              padding: '0.95rem 1.1rem',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              color: 'var(--bg)',
              background: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {actionLabel}
          </button>
          {phase === 'canceled' && (
            <button
              type="button"
              onClick={resetAttestation}
              style={{
                minWidth: 190,
                padding: '0.95rem 1.1rem',
                borderRadius: 999,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                color: 'var(--text)',
                background: 'transparent',
              }}
            >
              Reset progress
            </button>
          )}
        </div>
      </div>

      {/* Live status region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          padding: '1rem',
          borderRadius: 12,
          background: 'rgba(94,234,212,0.08)',
        }}
      >
        <p style={{ margin: 0, color: 'var(--text)' }}>{message}</p>
      </div>

      {/* ── Result animation (#529) ── shown after the attestation completes.
          Rendered outside the live region so the outcome message is the sole
          live announcement; the animation is decorative with an sr-only
          label and auto-disables under prefers-reduced-motion. */}
      {phase === 'complete' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1.25rem',
            borderRadius: 12,
            background: 'var(--success-soft)',
            border: '1px solid rgba(52, 211, 153, 0.28)',
          }}
        >
          <ResultAnimation outcome="success" label="Attestation complete" />
        </div>
      )}

      {/* ── Filter row (#219) ── */}
      <FilterRow
        eventTypeFilter={eventTypeFilter}
        actorFilter={actorFilter}
        onEventTypeChange={setEventTypeFilter}
        onActorChange={setActorFilter}
        onClear={clearFilters}
        filteredCount={filteredSteps.length}
        totalCount={ATTESTATION_STEPS.length}
      />

      {/* ── Timeline list (#217) ── */}
      {filteredSteps.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
          No events match the selected filters.
        </p>
      ) : (
        <ol
          aria-label="Attestation timeline events"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}
        >
          {filteredSteps.map((step) => {
            // Find the real index in the unfiltered array so step numbers + statuses stay correct
            const realIndex = ATTESTATION_STEPS.indexOf(step)
            const stepStatus = getStepStatus(realIndex, activeStep, phase)
            return (
              <ExpandableStep
                key={step.title}
                step={step}
                stepStatus={stepStatus}
                index={realIndex}
                defaultExpanded={stepStatus === 'active'}
              />
            )
          })}
        </ol>
      )}
    </section>
  )
}
