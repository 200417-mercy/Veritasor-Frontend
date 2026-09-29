import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AttestationProgress from './AttestationProgress'

const STEP_MS = 1100

function renderFlow(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AttestationProgress />
    </MemoryRouter>,
  )
}

function advanceSteps(count: number) {
  for (let i = 0; i < count; i++) {
    act(() => {
      vi.advanceTimersByTime(STEP_MS)
    })
  }
}

const statusText = (regex: RegExp) => screen.getAllByText(regex)

describe('AttestationProgress — phase transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts idle with the begin action and no cancel/reset controls', () => {
    renderFlow()

    expect(statusText(/ready to begin attestation processing/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^start attestation$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel attestation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset progress/i })).not.toBeInTheDocument()
  })

  it('enters the running phase on start, reporting step 1 of 4', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))

    expect(statusText(/step 1 of 4/i).length).toBeGreaterThan(0)
    expect(statusText(/collecting monthly revenue is in progress/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /cancel attestation/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^start attestation$/i })).not.toBeInTheDocument()
  })

  it('advances the active step as the timer elapses', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))

    advanceSteps(1)
    expect(statusText(/step 2 of 4/i).length).toBeGreaterThan(0)

    advanceSteps(1)
    expect(statusText(/step 3 of 4/i).length).toBeGreaterThan(0)

    advanceSteps(1)
    expect(statusText(/step 4 of 4/i).length).toBeGreaterThan(0)
  })

  it('reaches the complete phase and offers a repeat run', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))

    advanceSteps(5)

    expect(statusText(/attestation complete/i).length).toBeGreaterThan(0)
    expect(
      statusText(/attestation successfully published on stellar/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /start another attestation/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel attestation/i })).not.toBeInTheDocument()
  })

  it('cancels a running attestation and exposes reset', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel attestation/i }))

    expect(statusText(/attestation canceled/i).length).toBeGreaterThan(0)
    expect(statusText(/attestation processing was canceled/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /reset progress/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^start attestation$/i })).toBeInTheDocument()
  })

  it('does not advance steps after cancellation', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel attestation/i }))

    advanceSteps(5)

    expect(statusText(/attestation canceled/i).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/attestation complete/i)).toHaveLength(0)
  })

  it('resets back to the idle state', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel attestation/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }))

    expect(statusText(/ready to begin attestation processing/i).length).toBeGreaterThan(0)
    expect(statusText(/ready to generate a new revenue attestation/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /reset progress/i })).not.toBeInTheDocument()
  })
})

describe('AttestationProgress — timeline rendering and filtering', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders every step title in the timeline list', () => {
    renderFlow()

    const list = screen.getByRole('list', { name: /attestation timeline events/i })
    expect(list.querySelectorAll('li')).toHaveLength(4)
    expect(screen.getByText('Collecting monthly revenue')).toBeInTheDocument()
    expect(screen.getByText('Verifying input sources')).toBeInTheDocument()
    expect(screen.getByText('Building merkle root')).toBeInTheDocument()
    expect(screen.getByText('Publishing attestation to Stellar')).toBeInTheDocument()
  })

  it('reports the total event count when no filter is active', () => {
    renderFlow()

    expect(screen.getByText('4 events')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument()
  })

  it('filters down to matching event types and shows the partial count', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^verified$/i }))

    expect(screen.getByText('2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Verifying input sources')).toBeInTheDocument()
    expect(screen.getByText('Publishing attestation to Stellar')).toBeInTheDocument()
    expect(screen.queryByText('Collecting monthly revenue')).not.toBeInTheDocument()
  })

  it('shows the empty state when a filter matches no events', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^retried$/i }))

    expect(screen.getByText('0 of 4')).toBeInTheDocument()
    expect(screen.getByText(/no events match the selected filters/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: /attestation timeline events/i }),
    ).not.toBeInTheDocument()
  })

  it('filters by actor independently of event type', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^integration$/i }))

    expect(screen.getByText('1 of 4')).toBeInTheDocument()
    expect(screen.getByText('Collecting monthly revenue')).toBeInTheDocument()
  })

  it('combines event type and actor filters', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^verified$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^system$/i }))

    expect(screen.getByText('1 of 4')).toBeInTheDocument()
    expect(screen.getByText('Verifying input sources')).toBeInTheDocument()
  })

  it('clears all filters through the Clear control', () => {
    renderFlow()

    fireEvent.click(screen.getByRole('button', { name: /^verified$/i }))
    expect(screen.getByText('2 of 4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))

    expect(screen.getByText('4 events')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument()
  })

  it('marks the active filter chip with aria-pressed', () => {
    renderFlow()

    const verified = screen.getByRole('button', { name: /^verified$/i })
    expect(verified).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(verified)
    expect(verified).toHaveAttribute('aria-pressed', 'true')

    expect(screen.getByRole('button', { name: /^all types$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('hydrates the filter state from URL query params', () => {
    renderFlow('/?eventType=created&actor=system')

    expect(screen.getByText('1 of 4')).toBeInTheDocument()
    expect(screen.getByText('Building merkle root')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^created$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^system$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps each step trigger wired to its panel for assistive tech', () => {
    renderFlow()

    const trigger = screen.getByRole('button', { name: /collecting monthly revenue/i })
    const controls = trigger.getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    const panel = document.getElementById(controls as string)
    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute('role', 'region')
    expect(panel).toHaveAttribute('aria-labelledby', trigger.getAttribute('id'))
  })
})

describe('AttestationProgress — step expansion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the initial collapsed row state stable across phase changes', () => {
    renderFlow()
    const first = screen.getByRole('button', { name: /collecting monthly revenue/i })
    expect(first).toHaveAttribute('aria-expanded', 'false')

    // Starting the run must not silently force a row open.
    fireEvent.click(screen.getByRole('button', { name: /^start attestation$/i }))
    act(() => {
      vi.advanceTimersByTime(STEP_MS)
    })
    expect(first).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles a step open and closed on click', () => {
    renderFlow()
    const trigger = screen.getByRole('button', { name: /verifying input sources/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles a step with the Enter key', () => {
    renderFlow()
    const trigger = screen.getByRole('button', { name: /building merkle root/i })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
