/**
 * Regression coverage for the `phase === 'complete'` branch in
 * `getStepStatus` (src/components/AttestationProgress.tsx:91) and the
 * adjacent status branches it sits between.
 *
 * `getStepStatus` is module-private, so its branch behavior is asserted through
 * the rendered timeline: each step header renders "Done" / "In progress" /
 * "Pending" from the returned `StepStatus`.
 *
 * Covered:
 *  - idle  : every step is "Pending"
 *  - running: steps before the active one are "Done", the active one is
 *             "In progress", later ones are "Pending" (the two adjacent branches)
 *  - complete (line 91 branch): *every* step becomes "Done", including steps
 *             that were never reached and the step that was `activeStep`
 *  - canceled: the active-step branch is suppressed (no "In progress"), because
 *             `index + 1 === activeStep` only yields "active" while running
 */

import { act, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttestationProgress from '../components/AttestationProgress'

const STEP_COUNT = 4
const STEP_DURATION = 10

function renderProgress() {
  return render(
    <MemoryRouter>
      <AttestationProgress stepDurationMs={STEP_DURATION} />
    </MemoryRouter>,
  )
}

/** Advance the step-advancement timer chain by one tick. */
function tick() {
  act(() => {
    vi.advanceTimersByTime(STEP_DURATION)
  })
}

/** Run the component to the `complete` phase (4 chained timeouts). */
function runToCompletion() {
  for (let i = 0; i < STEP_COUNT; i += 1) tick()
}

describe('AttestationProgress — getStepStatus branch coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders every step as Pending while idle', () => {
    renderProgress()

    expect(screen.getByText('Ready to begin attestation processing')).toBeInTheDocument()
    expect(screen.getAllByText('Pending')).toHaveLength(STEP_COUNT)
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
  })

  it('marks earlier steps Done, the active step In progress, and later steps Pending while running', () => {
    renderProgress()

    fireEvent.click(screen.getByRole('button', { name: /start attestation/i }))
    tick() // 1 -> 2
    tick() // 2 -> 3

    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument()
    expect(screen.getAllByText('Done')).toHaveLength(2)
    expect(screen.getAllByText('In progress')).toHaveLength(1)
    expect(screen.getAllByText('Pending')).toHaveLength(1)
  })

  it('marks every step Done once the phase is complete (line 91 branch)', () => {
    renderProgress()

    fireEvent.click(screen.getByRole('button', { name: /start attestation/i }))
    runToCompletion()

    // The `phase === 'complete'` branch short-circuits before the index checks,
    // so all four steps are "Done" even though `activeStep` never visited a
    // "post-active" state for the last step.
    expect(screen.getAllByText('Attestation complete').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Done')).toHaveLength(STEP_COUNT)
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start another attestation/i })).toBeInTheDocument()
  })

  it('keeps the active step Pending after cancellation (running-only active branch)', () => {
    renderProgress()

    fireEvent.click(screen.getByRole('button', { name: /start attestation/i }))
    tick() // 1 -> 2
    tick() // 2 -> 3
    expect(screen.getAllByText('In progress')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /cancel attestation/i }))

    expect(screen.getByText('Attestation canceled')).toBeInTheDocument()
    // `phase === 'canceled'` is neither complete nor running, so the step that
    // would have been active falls through to "Pending".
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
    expect(screen.getAllByText('Pending')).toHaveLength(2)
    expect(screen.getAllByText('Done')).toHaveLength(2)
  })

  it('returns to all-Pending after reset from a canceled run', () => {
    renderProgress()

    fireEvent.click(screen.getByRole('button', { name: /start attestation/i }))
    tick()
    fireEvent.click(screen.getByRole('button', { name: /cancel attestation/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }))

    expect(screen.getByText('Ready to begin attestation processing')).toBeInTheDocument()
    expect(screen.getAllByText('Pending')).toHaveLength(STEP_COUNT)
  })
})
