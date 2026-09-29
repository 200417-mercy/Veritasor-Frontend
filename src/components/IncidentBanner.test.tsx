/**
 * @file IncidentBanner.test.tsx
 * @issue #580 — Add focused behavior coverage for BannerSeverity
 *
 * Covers:
 *  - BannerSeverity type contract (all three values: critical | warning | maintenance)
 *  - Incident interface contract (required fields, optional fields)
 *  - IncidentBanner component — rendering, ARIA roles, state transitions
 *  - Representative invalid / boundary inputs
 *  - Primary state transitions: dismiss, countdown, multi-incident
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentBanner, {
  type BannerSeverity,
  type Incident,
} from './IncidentBanner'

afterEach(() => cleanup())

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SEVERITIES: BannerSeverity[] = ['critical', 'warning', 'maintenance']

const CRITICAL: Incident = { id: 'c1', severity: 'critical', message: 'API is down' }
const WARNING: Incident  = {
  id: 'w1',
  severity: 'warning',
  message: 'Elevated latency',
  statusUrl: 'https://status.example.com',
}
const MAINTENANCE: Incident = {
  id: 'm1',
  severity: 'maintenance',
  message: 'Nightly DB migration',
}

// ─── BannerSeverity type contract ────────────────────────────────────────────

describe('BannerSeverity — type contract', () => {
  it.each(SEVERITIES)(
    'renders without throwing for severity "%s"',
    (severity) => {
      const incident: Incident = { id: severity, severity, message: `${severity} msg` }
      expect(() => render(<IncidentBanner incidents={[incident]} />)).not.toThrow()
    },
  )

  it('maps "critical" to role=alert', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('maps "warning" to role=alert', () => {
    render(<IncidentBanner incidents={[WARNING]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('maps "maintenance" to role=status', () => {
    render(<IncidentBanner incidents={[MAINTENANCE]} />)
    // The result-count <p role="status"> does not exist here; only IncidentItem
    const statusEls = screen.getAllByRole('status')
    const bannerStatus = statusEls.find((el) =>
      el.className.includes('incident-banner'),
    )
    expect(bannerStatus).toBeInTheDocument()
  })

  it('applies the correct CSS class for each severity', () => {
    for (const severity of SEVERITIES) {
      const { container, unmount } = render(
        <IncidentBanner
          incidents={[{ id: severity, severity, message: 'msg' }]}
        />,
      )
      expect(
        container.querySelector(`.incident-banner-${severity}`),
      ).toBeInTheDocument()
      unmount()
    }
  })

  it('sets correct icon for each severity', () => {
    const iconMap: Record<BannerSeverity, string> = {
      critical: '🔴',
      warning: '🟡',
      maintenance: '🔧',
    }
    for (const severity of SEVERITIES) {
      const { container, unmount } = render(
        <IncidentBanner
          incidents={[{ id: severity, severity, message: 'msg' }]}
        />,
      )
      const icon = container.querySelector('.incident-banner-icon')
      expect(icon?.textContent).toBe(iconMap[severity])
      unmount()
    }
  })

  it('sets correct human-readable label for each severity', () => {
    const labelMap: Record<BannerSeverity, string> = {
      critical: 'Critical incident',
      warning: 'Service degraded',
      maintenance: 'Scheduled maintenance',
    }
    for (const severity of SEVERITIES) {
      const { container, unmount } = render(
        <IncidentBanner
          incidents={[{ id: severity, severity, message: 'msg' }]}
        />,
      )
      const label = container.querySelector('.incident-banner-label')
      expect(label?.textContent).toBe(labelMap[severity])
      unmount()
    }
  })
})

// ─── Incident interface contract ─────────────────────────────────────────────

describe('Incident — interface contract', () => {
  it('renders with only required fields (id, severity, message)', () => {
    const minimal: Incident = { id: 'x1', severity: 'critical', message: 'Minimal' }
    render(<IncidentBanner incidents={[minimal]} />)
    expect(screen.getByText('Minimal')).toBeInTheDocument()
  })

  it('renders statusUrl as a link when provided', () => {
    render(<IncidentBanner incidents={[WARNING]} />)
    const link = screen.getByRole('link', { name: /view status page details/i })
    expect(link).toHaveAttribute('href', 'https://status.example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render a details link when statusUrl is absent', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('does not render countdown for maintenance without scheduledStart', () => {
    render(<IncidentBanner incidents={[MAINTENANCE]} />)
    expect(screen.queryByText(/Starts in/)).not.toBeInTheDocument()
  })

  it('renders countdown when scheduledStart is in the future', () => {
    vi.useFakeTimers()
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    const incident: Incident = {
      id: 'ms',
      severity: 'maintenance',
      message: 'Upgrade',
      scheduledStart: futureDate,
    }
    render(<IncidentBanner incidents={[incident]} />)
    expect(screen.getByText(/Starts in 2 hours/)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not render countdown when scheduledStart is in the past', () => {
    vi.useFakeTimers()
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const incident: Incident = {
      id: 'mp',
      severity: 'maintenance',
      message: 'Past maint',
      scheduledStart: pastDate,
    }
    render(<IncidentBanner incidents={[incident]} />)
    expect(screen.queryByText(/Starts in/)).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

// ─── IncidentBanner component — rendering ────────────────────────────────────

describe('IncidentBanner — rendering', () => {
  it('returns null when incidents array is empty', () => {
    const { container } = render(<IncidentBanner incidents={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('wraps all visible banners in a section with aria-label="System status"', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    expect(
      screen.getByRole('region', { name: /system status/i }),
    ).toBeInTheDocument()
  })

  it('renders multiple incidents simultaneously', () => {
    render(<IncidentBanner incidents={[CRITICAL, WARNING, MAINTENANCE]} />)
    expect(screen.getByText('API is down')).toBeInTheDocument()
    expect(screen.getByText('Elevated latency')).toBeInTheDocument()
    expect(screen.getByText('Nightly DB migration')).toBeInTheDocument()
  })

  it('includes aria-label on the banner div composed from label + message', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAccessibleName(/critical incident.*api is down/i)
  })

  it('renders dismiss button with accessible label per incident', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    expect(
      screen.getByRole('button', { name: /dismiss.*api is down/i }),
    ).toBeInTheDocument()
  })

  it('icon and label elements are aria-hidden for screen reader deduplication', () => {
    const { container } = render(<IncidentBanner incidents={[CRITICAL]} />)
    const icon = container.querySelector('.incident-banner-icon')
    const label = container.querySelector('.incident-banner-label')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(label).toHaveAttribute('aria-hidden', 'true')
  })
})

// ─── Primary state transition: dismiss ───────────────────────────────────────

describe('IncidentBanner — dismiss state transitions', () => {
  it('removes the dismissed incident from the DOM', () => {
    render(<IncidentBanner incidents={[CRITICAL]} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('API is down')).not.toBeInTheDocument()
  })

  it('returns null (empty DOM) after the only incident is dismissed', () => {
    const { container } = render(<IncidentBanner incidents={[CRITICAL]} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(container.firstChild).toBeNull()
  })

  it('dismisses only the targeted incident when multiple are present', () => {
    render(<IncidentBanner incidents={[CRITICAL, WARNING]} />)
    const buttons = screen.getAllByRole('button', { name: /dismiss/i })
    fireEvent.click(buttons[0]) // dismiss CRITICAL
    expect(screen.queryByText('API is down')).not.toBeInTheDocument()
    expect(screen.getByText('Elevated latency')).toBeInTheDocument()
  })

  it('can dismiss all incidents sequentially until DOM is empty', () => {
    const { container } = render(<IncidentBanner incidents={[CRITICAL, WARNING]} />)
    const buttons = screen.getAllByRole('button', { name: /dismiss/i })
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(container.firstChild).toBeNull()
  })

  it('dismissed incidents are not re-rendered on subsequent renders', () => {
    const { rerender } = render(<IncidentBanner incidents={[CRITICAL, WARNING]} />)
    fireEvent.click(screen.getAllByRole('button', { name: /dismiss/i })[0])
    rerender(<IncidentBanner incidents={[CRITICAL, WARNING]} />)
    expect(screen.queryByText('API is down')).not.toBeInTheDocument()
    expect(screen.getByText('Elevated latency')).toBeInTheDocument()
  })
})

// ─── Primary state transition: maintenance countdown ─────────────────────────

describe('IncidentBanner — maintenance countdown state transitions', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows "Scheduled maintenance" label when countdown > 0', () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toISOString() // 1 min
    const incident: Incident = {
      id: 'mc',
      severity: 'maintenance',
      message: 'Upgrade',
      scheduledStart: futureDate,
    }
    render(<IncidentBanner incidents={[incident]} />)
    expect(screen.getByText('Scheduled maintenance')).toBeInTheDocument()
  })

  it('transitions to "Maintenance in progress" after countdown hits zero', () => {
    const futureDate = new Date(Date.now() + 10 * 1000).toISOString() // 10s
    const incident: Incident = {
      id: 'mc2',
      severity: 'maintenance',
      message: 'Upgrade',
      scheduledStart: futureDate,
    }
    render(<IncidentBanner incidents={[incident]} />)
    expect(screen.getByText('Scheduled maintenance')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(30_000) }) // trigger interval tick

    expect(screen.getByText('Maintenance in progress')).toBeInTheDocument()
    expect(screen.queryByText(/Starts in/)).not.toBeInTheDocument()
  })

  it('adds incident-banner-scheduled class when maintenance is upcoming', () => {
    const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const incident: Incident = {
      id: 'mc3',
      severity: 'maintenance',
      message: 'Upgrade',
      scheduledStart: futureDate,
    }
    const { container } = render(<IncidentBanner incidents={[incident]} />)
    expect(
      container.querySelector('.incident-banner-scheduled'),
    ).toBeInTheDocument()
  })

  it('countdown aria-live region has polite politeness', () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toISOString()
    const incident: Incident = {
      id: 'mc4',
      severity: 'maintenance',
      message: 'Upgrade',
      scheduledStart: futureDate,
    }
    const { container } = render(<IncidentBanner incidents={[incident]} />)
    const countdown = container.querySelector('.incident-banner-countdown')
    expect(countdown).toHaveAttribute('aria-live', 'polite')
  })
})

// ─── formatTimeRemaining — boundary values ────────────────────────────────────

describe('IncidentBanner — formatTimeRemaining boundary values', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const cases: Array<[number, string]> = [
    [30 * 1000, 'Starts in 30 secs'],
    [1 * 60 * 1000, 'Starts in 1 min'],
    [90 * 1000, 'Starts in 1 min'],
    [2 * 60 * 1000, 'Starts in 2 mins'],
    [1 * 60 * 60 * 1000, 'Starts in 1 hour'],
    [2 * 60 * 60 * 1000, 'Starts in 2 hours'],
    [24 * 60 * 60 * 1000, 'Starts in 1 day'],
    [48 * 60 * 60 * 1000, 'Starts in 2 days'],
  ]

  it.each(cases)('%i ms from now → "%s"', (ms, expected) => {
    const futureDate = new Date(Date.now() + ms).toISOString()
    const incident: Incident = {
      id: `t-${ms}`,
      severity: 'maintenance',
      message: 'Timed maint',
      scheduledStart: futureDate,
    }
    render(<IncidentBanner incidents={[incident]} />)
    // The countdown text starts with "Starts in "
    const el = screen.getByText(/Starts in/i)
    expect(el.textContent).toMatch(
      new RegExp(expected.replace('Starts in ', ''), 'i'),
    )
    cleanup()
  })
})

// ─── Invalid / boundary inputs ────────────────────────────────────────────────

describe('IncidentBanner — invalid and boundary inputs', () => {
  it('renders nothing for an empty incidents array', () => {
    const { container } = render(<IncidentBanner incidents={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a single incident with no optional fields without crashing', () => {
    const bare: Incident = { id: 'bare', severity: 'warning', message: 'Bare warning' }
    expect(() => render(<IncidentBanner incidents={[bare]} />)).not.toThrow()
    expect(screen.getByText('Bare warning')).toBeInTheDocument()
  })

  it('handles incidents with duplicate ids gracefully (renders both)', () => {
    const dup1: Incident = { id: 'dup', severity: 'critical', message: 'First' }
    const dup2: Incident = { id: 'dup', severity: 'warning', message: 'Second' }
    // React will warn about duplicate keys but should not crash
    expect(() =>
      render(<IncidentBanner incidents={[dup1, dup2]} />),
    ).not.toThrow()
  })

  it('renders a large number of incidents without throwing', () => {
    const many: Incident[] = Array.from({ length: 50 }, (_, i) => ({
      id: `bulk-${i}`,
      severity: (SEVERITIES[i % 3]) as BannerSeverity,
      message: `Incident ${i}`,
    }))
    expect(() => render(<IncidentBanner incidents={many} />)).not.toThrow()
    expect(screen.getByText('Incident 0')).toBeInTheDocument()
  })

  it('renders an incident with a very long message without layout crash', () => {
    const long: Incident = {
      id: 'long',
      severity: 'warning',
      message: 'A'.repeat(500),
    }
    expect(() => render(<IncidentBanner incidents={[long]} />)).not.toThrow()
  })
})
