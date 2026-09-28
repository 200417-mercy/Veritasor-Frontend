import { Component, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import AuditLogTimeline, { type AuditLogEntry, type SeverityLevel } from './AuditLogTimeline'
import { useDensityMode } from '../../hooks/useDensityMode'

vi.mock('../../hooks/useDensityMode')

const mockUseDensityMode = vi.mocked(useDensityMode)

const baseEntries = [
  { id: '1', timestamp: '2026-07-28T08:12:00Z', event: 'Attestation completed', details: 'Merkle root: 0x7f...3a' },
  { id: '2', timestamp: '2026-07-28T08:14:00Z', event: 'Attestation completed', details: 'Merkle root: 0x7f...3a' },
  { id: '3', timestamp: '2026-07-28T08:15:00Z', event: 'Attestation completed', details: 'Merkle root: 0x7f...3a' },
  { id: '4', timestamp: '2026-07-28T09:00:00Z', event: 'Revenue source connected', details: 'Provider: Stripe' },
  { id: '5', timestamp: '2026-07-27T14:30:00Z', event: 'Attestation failed', details: 'Timeout after 30s' },
  { id: '6', timestamp: '2026-07-27T14:31:00Z', event: 'Attestation failed', details: 'Timeout after 30s' },
  { id: '7', timestamp: '2026-07-27T14:32:00Z', event: 'Attestation failed', details: 'Timeout after 30s' },
  { id: '8', timestamp: '2026-07-27T14:33:00Z', event: 'Attestation failed', details: 'Timeout after 30s' },
  { id: '9', timestamp: '2026-07-26T10:00:00Z', event: 'API key rotated' },
]

function setup(density: 'comfortable' | 'compact' = 'comfortable') {
  mockUseDensityMode.mockReturnValue({ density, setDensity: vi.fn() })
}

describe('AuditLogTimeline', () => {
  describe('comfortable density', () => {
    beforeEach(() => {
      setup('comfortable')
    })

    it('renders with entries', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByRole('log', { name: /audit log timeline/i })).toBeInTheDocument()
    })

    it('renders all individual entries', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(9)
    })

    it('does not collapse identical consecutive events', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getAllByText('Attestation completed')).toHaveLength(3)
    })

    it('renders timestamps for each entry', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByText('08:12 AM')).toBeInTheDocument()
      expect(screen.getByText('09:00 AM')).toBeInTheDocument()
    })

    it('renders details when provided', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getAllByText('Merkle root: 0x7f...3a')).toHaveLength(3)
    })

    it('renders entry without details when details are absent', () => {
      const noDetails = [{ id: '1', timestamp: '2026-07-28T10:00:00Z', event: 'API key rotated' }]
      render(<AuditLogTimeline entries={noDetails} />)
      expect(screen.getByText('API key rotated')).toBeInTheDocument()
    })

    it('shows empty state when no entries', () => {
      render(<AuditLogTimeline entries={[]} />)
      expect(screen.getByText('No audit log entries.')).toBeInTheDocument()
    })

    it('empty state has aria-live region', () => {
      render(<AuditLogTimeline entries={[]} />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('compact density', () => {
    beforeEach(() => {
      setup('compact')
    })

    it('groups entries by day', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByRole('heading', { name: /July 28, 2026/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /July 27, 2026/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /July 26, 2026/ })).toBeInTheDocument()
    })

    it('collapses identical consecutive events into a burst summary', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByText('Attestation completed')).toBeInTheDocument()
      const badges = screen.getAllByLabelText(/events/)
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it('shows burst badge with correct count', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      const badge = screen.getByLabelText('3 events')
      expect(badge).toBeInTheDocument()
    })

    it('does not collapse events below burst threshold', () => {
      const twoSame = [
        { id: '1', timestamp: '2026-07-28T08:12:00Z', event: 'Attestation completed' },
        { id: '2', timestamp: '2026-07-28T08:13:00Z', event: 'Attestation completed' },
      ]
      render(<AuditLogTimeline entries={twoSame} burstThreshold={3} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('collapses events at or above burst threshold', () => {
      const threeSame = [
        { id: '1', timestamp: '2026-07-28T08:12:00Z', event: 'Attestation completed' },
        { id: '2', timestamp: '2026-07-28T08:13:00Z', event: 'Attestation completed' },
        { id: '3', timestamp: '2026-07-28T08:14:00Z', event: 'Attestation completed' },
      ]
      render(<AuditLogTimeline entries={threeSame} burstThreshold={3} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
      expect(screen.getByLabelText('3 events')).toBeInTheDocument()
    })

    it('shows time range for burst groups', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByText('08:12 AM \u2013 08:15 AM')).toBeInTheDocument()
    })

    it('shows individual entries alongside burst groups', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByText('Revenue source connected')).toBeInTheDocument()
      expect(screen.getByText('API key rotated')).toBeInTheDocument()
    })

    it('renders day group sections with aria-labelledby', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      const dayHeadings = screen.getAllByRole('heading', { level: 3 })
      expect(dayHeadings.length).toBe(3)
      baseEntries
        .map((e) => new Date(e.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .filter((v, i, a) => a.indexOf(v) === i)
        .forEach((date) => {
          expect(document.getElementById(`day-heading-${date}`)).toBeInTheDocument()
        })
    })

    it('day group has aria-label on the list', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByLabelText(/Events for July 28, 2026/)).toBeInTheDocument()
    })

    it('shows empty state when no entries', () => {
      render(<AuditLogTimeline entries={[]} />)
      expect(screen.getByText('No audit log entries.')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    beforeEach(() => {
      setup('compact')
    })

    it('has role="log" on the timeline container', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByRole('log')).toBeInTheDocument()
    })

    it('has aria-label on the log container', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByRole('log', { name: /audit log timeline/i })).toBeInTheDocument()
    })

    it('has aria-live="polite" for dynamic updates', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite')
    })

    it('day headings use h3 for hierarchy', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      const h3s = screen.getAllByRole('heading', { level: 3 })
      expect(h3s.length).toBeGreaterThan(0)
    })

    it('list items have role="listitem"', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      const items = screen.getAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
    })

    it('burst badge has descriptive aria-label', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      expect(screen.getByLabelText('3 events')).toBeInTheDocument()
    })

    it('day group heading is linked via aria-labelledby', () => {
      render(<AuditLogTimeline entries={baseEntries} />)
      const headingId = 'day-heading-July 28, 2026'
      expect(document.getElementById(headingId)).toBeInTheDocument()
    })
  })

  describe('burst threshold customization', () => {
    beforeEach(() => {
      setup('compact')
    })

    it('uses custom burst threshold', () => {
      const twoSame = [
        { id: '1', timestamp: '2026-07-28T08:12:00Z', event: 'Event A' },
        { id: '2', timestamp: '2026-07-28T08:13:00Z', event: 'Event A' },
      ]
      render(<AuditLogTimeline entries={twoSame} burstThreshold={2} />)
      expect(screen.getByLabelText('2 events')).toBeInTheDocument()
    })

    it('does not collapse when threshold is higher than burst size', () => {
      const twoSame = [
        { id: '1', timestamp: '2026-07-28T08:12:00Z', event: 'Event A' },
        { id: '2', timestamp: '2026-07-28T08:13:00Z', event: 'Event A' },
      ]
      render(<AuditLogTimeline entries={twoSame} burstThreshold={5} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })
  })
})

// ─── SeverityLevel coverage ──────────────────────────────────────────────────
// `AuditLogTimeline.tsx` is the only module that declares `SeverityLevel`. The
// suite above never passes a `severity`, so the chip contract, the absent-
// severity path and the legend transition were all unverified.

/** Minimal error boundary so the invalid-severity case can be asserted without
 * React re-throwing the render error into the test runner. */
class SeverityBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return <span data-testid="severity-error">{this.state.error.message}</span>
    }
    return this.props.children
  }
}

const severityEntries: AuditLogEntry[] = [
  { id: 'sev-info', timestamp: '2026-07-28T08:12:00Z', event: 'Policy updated', severity: 'info' },
  { id: 'sev-warn', timestamp: '2026-07-28T08:13:00Z', event: 'Rate limit nearing', severity: 'warn' },
  { id: 'sev-error', timestamp: '2026-07-28T08:14:00Z', event: 'Attestation failed', severity: 'error' },
  { id: 'sev-critical', timestamp: '2026-07-28T08:15:00Z', event: 'Signing key compromised', severity: 'critical' },
]

/** [severity, documented label, documented icon] — one row per union member. */
const SEVERITY_LABELS: Array<[SeverityLevel, string, string]> = [
  ['info', 'Info', '\u2139\ufe0f'],
  ['warn', 'Warning', '\u26a0\ufe0f'],
  ['error', 'Error', '\u274c'],
  ['critical', 'Critical', '\ud83d\udea8'],
]

const severityChipName = /^Severity: /

describe('SeverityLevel', () => {
  beforeEach(() => {
    setup('comfortable')
  })

  it('renders the documented label and icon for every union member', () => {
    render(<AuditLogTimeline entries={severityEntries} />)

    for (const [, label, icon] of SEVERITY_LABELS) {
      const chip = screen.getByLabelText(`Severity: ${label}`)
      expect(chip).toHaveTextContent(icon)
      expect(chip).toHaveTextContent(label)
    }
    expect(screen.getAllByLabelText(severityChipName)).toHaveLength(SEVERITY_LABELS.length)
  })

  it('pairs each chip with the entry that declares that severity', () => {
    render(<AuditLogTimeline entries={severityEntries} />)

    const row = screen.getByText('Signing key compromised').closest('li')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByLabelText('Severity: Critical')).toBeInTheDocument()
    expect(within(row as HTMLElement).queryByLabelText('Severity: Info')).not.toBeInTheDocument()
  })

  it('renders no chip when the entry omits severity', () => {
    const plain: AuditLogEntry[] = [
      { id: 'plain', timestamp: '2026-07-28T08:12:00Z', event: 'API key rotated' },
    ]
    render(<AuditLogTimeline entries={plain} />)

    expect(screen.getByText('API key rotated')).toBeInTheDocument()
    expect(screen.queryByLabelText(severityChipName)).not.toBeInTheDocument()
  })

  it('chips only the entries that declare a severity in a mixed list', () => {
    const mixed: AuditLogEntry[] = [
      severityEntries[0],
      { id: 'plain', timestamp: '2026-07-28T08:16:00Z', event: 'Viewer exported report' },
      severityEntries[3],
    ]
    render(<AuditLogTimeline entries={mixed} />)

    expect(screen.getAllByLabelText(severityChipName)).toHaveLength(2)
    expect(screen.getByLabelText('Severity: Info')).toBeInTheDocument()
    expect(screen.queryByLabelText('Severity: Error')).not.toBeInTheDocument()
  })

  it('rejects an out-of-contract severity rather than rendering an unstyled chip', () => {
    const invalid: AuditLogEntry[] = [
      {
        id: 'invalid',
        timestamp: '2026-07-28T08:12:00Z',
        event: 'Unknown severity',
        // Simulates an untyped payload (e.g. a raw API response) bypassing the union.
        severity: 'fatal' as unknown as SeverityLevel,
      },
    ]

    // `SEVERITY_META` is an exhaustive record over the closed union, so an
    // unlisted severity must fail loudly during render instead of degrading
    // silently. React logs the caught error; silence that expected noise.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <SeverityBoundary>
          <AuditLogTimeline entries={invalid} />
        </SeverityBoundary>,
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(screen.getByTestId('severity-error').textContent).toMatch(/label/)
  })

  it('renders chips inside compact-density rows as well', () => {
    setup('compact')
    render(<AuditLogTimeline entries={severityEntries} />)

    const chip = screen.getByLabelText('Severity: Critical')
    expect(chip).toBeInTheDocument()
    expect(chip.closest('button')).not.toBeNull()
  })
})

describe('SeverityLegend', () => {
  beforeEach(() => {
    setup('compact')
  })

  it('starts collapsed and reveals every severity label when opened', () => {
    render(<AuditLogTimeline entries={severityEntries} />)

    const toggle = screen.getByLabelText('Toggle severity legend')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const legend = screen.getByRole('tooltip', { name: 'Severity legend' })
    for (const [, label] of SEVERITY_LABELS) {
      expect(legend).toHaveTextContent(label)
    }
  })

  it('collapses again on the second toggle', () => {
    render(<AuditLogTimeline entries={severityEntries} />)

    const toggle = screen.getByLabelText('Toggle severity legend')
    fireEvent.click(toggle)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('is rendered in comfortable density too', () => {
    setup('comfortable')
    render(<AuditLogTimeline entries={severityEntries} />)

    expect(screen.getByLabelText('Toggle severity legend')).toBeInTheDocument()
  })
})

describe('detail drawer state transition', () => {
  beforeEach(() => {
    setup('compact')
  })

  it('opens with the base entry when no detail loader is supplied', () => {
    render(<AuditLogTimeline entries={severityEntries} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/View details for Policy updated/))

    expect(screen.getByRole('dialog')).toHaveTextContent('Policy updated')
  })

  it('awaits the detail loader and renders the enriched entry', async () => {
    const onFetchDetail = vi.fn().mockResolvedValue({
      id: 'sev-info',
      timestamp: '2026-07-28T08:12:00Z',
      event: 'Policy updated (enriched)',
      actor: 'ops@veritasor.io',
      severity: 'info',
    })
    render(<AuditLogTimeline entries={severityEntries} onFetchDetail={onFetchDetail} />)

    fireEvent.click(screen.getByLabelText(/View details for Policy updated/))

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent('Policy updated (enriched)'),
    )
    expect(onFetchDetail).toHaveBeenCalledWith('sev-info')
    expect(screen.getByRole('dialog')).toHaveTextContent('ops@veritasor.io')
  })

  it('closes on Escape and restores focus to the triggering row', () => {
    render(<AuditLogTimeline entries={severityEntries} />)
    const trigger = screen.getByLabelText(/View details for Policy updated/)

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})
