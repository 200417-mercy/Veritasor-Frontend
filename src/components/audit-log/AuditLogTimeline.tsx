import { useState, useRef } from 'react'
import { useDensityMode } from '../../hooks/useDensityMode'
import type { CSSProperties } from 'react'
import AuditLogDetailDrawer from './AuditLogDetailDrawer'
import type { AuditLogEntryDetail } from './AuditLogDetailDrawer'

export type SeverityLevel = 'info' | 'warn' | 'error' | 'critical'

export interface AuditLogEntry {
  id: string
  timestamp: string
  event: string
  details?: string
  severity?: SeverityLevel
}

// Colorblind-safe severity palette using shape + color + icon
// Uses blue, orange, red, and purple (no red-green dependency)
const SEVERITY_META: Record<SeverityLevel, {
  label: string
  icon: string
  /** Accessible dot color */
  dot: string
  /** Background tint */
  bg: string
  /** Border tint */
  border: string
}> = {
  info: {
    label: 'Info',
    icon: 'ℹ️',
    dot: '#60a5fa',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.30)',
  },
  warn: {
    label: 'Warning',
    icon: '⚠️',
    dot: '#fb923c',
    bg: 'rgba(251,146,60,0.10)',
    border: 'rgba(251,146,60,0.30)',
  },
  error: {
    label: 'Error',
    icon: '❌',
    dot: '#f87171',
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.30)',
  },
  critical: {
    label: 'Critical',
    icon: '🚨',
    dot: '#c084fc',
    bg: 'rgba(192,132,252,0.10)',
    border: 'rgba(192,132,252,0.30)',
  },
}

function SeverityChip({ severity }: { severity: SeverityLevel }) {
  const meta = SEVERITY_META[severity]
  return (
    <span
      aria-label={`Severity: ${meta.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.1rem 0.45rem',
        borderRadius: 4,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.dot,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

interface SeverityLegendProps {
  open: boolean
  onToggle: () => void
}

function SeverityLegend({ open, onToggle }: SeverityLegendProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle severity legend"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--surface-strong)',
          color: 'var(--muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 120ms',
        }}
      >
        <span aria-hidden="true">📋</span>
        Legend
      </button>
      {open && (
        <div
          role="tooltip"
          aria-label="Severity legend"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.35rem',
            zIndex: 10,
            display: 'grid',
            gap: '0.35rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(2,6,23,0.4)',
            minWidth: 160,
          }}
        >
          {(['info', 'warn', 'error', 'critical'] as const).map((level) => {
            const meta = SEVERITY_META[level]
            return (
              <div
                key={level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '0.9rem', width: '1.2rem', textAlign: 'center' }}>
                  {meta.icon}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: meta.dot,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface GroupedDay {
  date: string
  entries: AuditLogEntry[]
}

interface BurstGroup {
  event: string
  count: number
  firstTimestamp: string
  lastTimestamp: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupByDay(entries: AuditLogEntry[]): GroupedDay[] {
  const map = new Map<string, AuditLogEntry[]>()
  for (const entry of entries) {
    const day = formatDate(entry.timestamp)
    const existing = map.get(day)
    if (existing) {
      existing.push(entry)
    } else {
      map.set(day, [entry])
    }
  }
  return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }))
}

function collapseBursts(entries: AuditLogEntry[], threshold: number): (AuditLogEntry | BurstGroup)[] {
  const result: (AuditLogEntry | BurstGroup)[] = []
  let i = 0
  while (i < entries.length) {
    const current = entries[i]
    let burstCount = 1
    let j = i + 1
    while (j < entries.length && entries[j].event === current.event) {
      burstCount++
      j++
    }
    if (burstCount >= threshold) {
      result.push({
        event: current.event,
        count: burstCount,
        firstTimestamp: current.timestamp,
        lastTimestamp: entries[j - 1].timestamp,
      })
    } else {
      for (let k = i; k < j; k++) {
        result.push(entries[k])
      }
    }
    i = j
  }
  return result
}

interface AuditLogTimelineProps {
  entries: AuditLogEntry[]
  burstThreshold?: number
  /** Provide enriched entry detail on demand; falls back to base entry if omitted */
  onFetchDetail?: (id: string) => AuditLogEntryDetail | Promise<AuditLogEntryDetail>
}

const burstThresholdDefault = 3

const groupStyle: CSSProperties = {
  padding: 'var(--density-padding)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--surface-strong)',
  marginBottom: 'var(--density-gap)',
}

const dayHeaderStyle: CSSProperties = {
  fontSize: 'var(--density-text-sm)',
  fontWeight: 700,
  color: 'var(--accent)',
  marginBottom: 'var(--density-row-gap)',
  paddingBottom: 'var(--space-1)',
  borderBottom: '1px solid var(--border)',
}

const entryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-2)',
  padding: 'var(--space-1) 0',
  borderBottom: '1px solid var(--border)',
}

const burstStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-1) 0',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-soft)',
  borderRadius: 'var(--radius-sm)',
  paddingLeft: 'var(--space-2)',
  paddingRight: 'var(--space-2)',
  marginBottom: 'var(--space-1)',
}

const timeStyle: CSSProperties = {
  fontSize: 'var(--density-text-sm)',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  minWidth: '4.5rem',
}

const eventStyle: CSSProperties = {
  fontSize: 'var(--density-text-sm)',
  fontWeight: 600,
}

const detailStyle: CSSProperties = {
  fontSize: 'var(--density-text-muted)',
  color: 'var(--muted)',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.5rem',
  height: '1.5rem',
  padding: '0 0.35rem',
  borderRadius: '999px',
  background: 'var(--accent)',
  color: '#04111f',
  fontWeight: 700,
  fontSize: 'var(--density-badge-font)',
  lineHeight: 1,
}

export default function AuditLogTimeline({
  entries,
  burstThreshold = burstThresholdDefault,
  onFetchDetail,
}: AuditLogTimelineProps) {
  const { density } = useDensityMode('default')
  const isCompact = density === 'compact'
  const [legendOpen, setLegendOpen] = useState(false)

  const [activeDetail, setActiveDetail] = useState<AuditLogEntryDetail | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  async function openDrawer(entry: AuditLogEntry, triggerEl: HTMLElement) {
    triggerRef.current = triggerEl
    if (onFetchDetail) {
      const detail = await Promise.resolve(onFetchDetail(entry.id))
      setActiveDetail(detail)
    } else {
      setActiveDetail(entry)
    }
  }

  function closeDrawer() {
    setActiveDetail(null)
  }

  // Shared style for entry row button wrapper
  const rowButtonStyle: CSSProperties = {
    all: 'unset',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-2)',
    padding: 'var(--space-1) 0',
    borderBottom: '1px solid var(--border)',
    width: '100%',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background 100ms ease',
  }

  if (entries.length === 0) {
    return (
      <div role="status" aria-live="polite" style={{ padding: 'var(--density-padding)', color: 'var(--muted)' }}>
        No audit log entries.
      </div>
    )
  }

  if (isCompact) {
    const days = groupByDay(entries)
    return (
      <>
        <div role="log" aria-label="Audit log timeline" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <SeverityLegend open={legendOpen} onToggle={() => setLegendOpen((p) => !p)} />
          </div>
          {days.map((day) => {
            const bursts = collapseBursts(day.entries, burstThreshold)
            return (
              <section key={day.date} style={groupStyle} aria-labelledby={`day-heading-${day.date}`}>
                <h3 id={`day-heading-${day.date}`} style={dayHeaderStyle}>
                  {day.date}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Events for ${day.date}`}>
                  {bursts.map((item, index) => {
                    if ('count' in item) {
                      const burst = item as BurstGroup
                      return (
                        <li key={`burst-${index}`} style={burstStyle} role="listitem">
                          <span style={badgeStyle} aria-label={`${burst.count} events`}>{burst.count}</span>
                          <span style={eventStyle}>{burst.event}</span>
                          <span style={{ ...detailStyle, marginLeft: 'auto' }}>
                            {formatTime(burst.firstTimestamp)} – {formatTime(burst.lastTimestamp)}
                          </span>
                        </li>
                      )
                    }
                    const entry = item as AuditLogEntry
                    return (
                      <li key={entry.id} role="listitem" style={{ listStyle: 'none' }}>
                        <button
                          type="button"
                          aria-label={`View details for ${entry.event} at ${formatTime(entry.timestamp)}`}
                          onClick={(e) => openDrawer(entry, e.currentTarget)}
                          style={rowButtonStyle}
                        >
                          <span style={timeStyle}>{formatTime(entry.timestamp)}</span>
                          {entry.severity && (
                            <span style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                              <SeverityChip severity={entry.severity} />
                            </span>
                          )}
                          <div>
                            <span style={eventStyle}>{entry.event}</span>
                            {entry.details && (
                              <p style={{ ...detailStyle, margin: '0.15rem 0 0' }}>{entry.details}</p>
                            )}
                          </div>
                          <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '0.75rem', paddingTop: '0.05rem', flexShrink: 0 }}>›</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
        <AuditLogDetailDrawer
          entry={activeDetail}
          onClose={closeDrawer}
          triggerRef={triggerRef}
        />
      </>
    )
  }

  return (
    <>
      <div role="log" aria-label="Audit log timeline" aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <SeverityLegend open={legendOpen} onToggle={() => setLegendOpen((p) => !p)} />
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entries.map((entry) => (
            <li key={entry.id} style={entryStyle} role="listitem">
              <span style={timeStyle}>{formatTime(entry.timestamp)}</span>
              {entry.severity && (
                <span style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                  <SeverityChip severity={entry.severity} />
                </span>
              )}
              <div>
                <span style={eventStyle}>{entry.event}</span>
                {entry.details && (
                  <p style={{ ...detailStyle, margin: '0.15rem 0 0' }}>{entry.details}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <AuditLogDetailDrawer
        entry={activeDetail}
        onClose={closeDrawer}
        triggerRef={triggerRef}
      />
    </>
  )
}
