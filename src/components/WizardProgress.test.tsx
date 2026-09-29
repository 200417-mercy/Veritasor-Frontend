import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WizardProgress from './WizardProgress'

/**
 * Focused behavior coverage for `WizardProgress`.
 *
 * The component is the only source of progress semantics for the connect
 * flow, so the tests concentrate on the contract callers and assistive tech
 * depend on:
 *
 *  1. The visual caption and the screen-reader announcement are 1-based while
 *     the props are 0-based — an off-by-one here is invisible to sighted users.
 *  2. `aria-current="step"` must mark exactly one item, and it must move.
 *  3. Completed items are marked with a tick rather than their number.
 *  4. Boundary indices (first step, last step, empty list, out-of-range) are
 *     deterministic instead of silently rendering the wrong step.
 */

type Step = { id: string; label: string; detail: string }

const STEPS: Step[] = [
  { id: 'credentials', label: 'Credentials', detail: 'Enter your API key' },
  { id: 'mapping', label: 'Mapping', detail: 'Match your columns' },
  { id: 'review', label: 'Review', detail: 'Confirm and import' },
]

const ANNOUNCEMENT_ID = 'wizard-progress-announcement'

function nav(): HTMLElement {
  return screen.getByRole('navigation')
}

function items(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.wizard-progress-item'))
}

function announcement(): HTMLElement {
  const el = document.getElementById(ANNOUNCEMENT_ID)
  if (!el) throw new Error('announcement region not found')
  return el
}

describe('WizardProgress - landmark semantics', () => {
  it('renders a single navigation landmark named for the connect flow', () => {
    render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    expect(screen.getByRole('navigation', { name: 'Connect source progress' })).toBe(nav())
    expect(nav().tagName).toBe('NAV')
  })

  it('ties the landmark to the announcement region with aria-describedby', () => {
    render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    expect(nav()).toHaveAttribute('aria-describedby', ANNOUNCEMENT_ID)
    expect(announcement()).toBeInTheDocument()
    expect(announcement()).toHaveAttribute('id', ANNOUNCEMENT_ID)
  })

  it('exposes the steps as an ordered list with one item per step', () => {
    const { container } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    const list = container.querySelector('.wizard-progress-list')
    expect(list?.tagName).toBe('OL')
    expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(STEPS.length)
  })

  it('hides the visual caption from assistive tech to avoid duplicate announcements', () => {
    const { container } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces changes politely and atomically', () => {
    render(<WizardProgress currentStepIndex={2} steps={STEPS} />)

    expect(announcement()).toHaveAttribute('role', 'status')
    expect(announcement()).toHaveAttribute('aria-live', 'polite')
    expect(announcement()).toHaveAttribute('aria-atomic', 'true')
  })
})

describe('WizardProgress - 1-based position reporting', () => {
  it('reports the first step as "Step 1 of 3"', () => {
    const { container } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 1 of 3')
    expect(announcement()).toHaveTextContent('Step 1 of 3: Credentials')
  })

  it('reports a middle step with its label in the announcement', () => {
    const { container } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 2 of 3')
    expect(announcement()).toHaveTextContent('Step 2 of 3: Mapping')
  })

  it('reports the last step with the full step count', () => {
    const { container } = render(<WizardProgress currentStepIndex={2} steps={STEPS} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 3 of 3')
    expect(announcement()).toHaveTextContent('Step 3 of 3: Review')
  })

  it('follows a currentStepIndex change on re-render', () => {
    const { container, rerender } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    rerender(<WizardProgress currentStepIndex={2} steps={STEPS} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 3 of 3')
    expect(announcement()).toHaveTextContent('Review')
  })

  it('renders every step label and detail regardless of position', () => {
    const { container } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    const copy = container.querySelector('.wizard-progress-copy')
    expect(copy).not.toBeNull()
    for (const step of STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument()
      expect(screen.getByText(step.detail)).toBeInTheDocument()
    }
  })
})

describe('WizardProgress - current step marking', () => {
  it('marks only the current item with aria-current="step"', () => {
    const { container } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    const marked = items(container).filter((el) => el.getAttribute('aria-current') === 'step')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toBe(items(container)[1])
  })

  it('moves the marker as the step advances', () => {
    const { container, rerender } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    rerender(<WizardProgress currentStepIndex={2} steps={STEPS} />)

    expect(items(container)[1]).not.toHaveAttribute('aria-current')
    expect(items(container)[2]).toHaveAttribute('aria-current', 'step')
  })

  it('adds the is-current class to the current item only', () => {
    const { container } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    expect(items(container)[0]).toHaveClass('is-current')
    expect(items(container)[1]).not.toHaveClass('is-current')
  })
})

describe('WizardProgress - completed steps', () => {
  it('marks preceding steps complete with a tick instead of their number', () => {
    const { container } = render(<WizardProgress currentStepIndex={2} steps={STEPS} />)

    const markers = Array.from(container.querySelectorAll<HTMLElement>('.wizard-progress-marker'))
    expect(markers.map((m) => m.textContent)).toEqual(['✓', '✓', '3'])
    expect(items(container)[0]).toHaveClass('is-complete')
    expect(items(container)[1]).toHaveClass('is-complete')
    expect(items(container)[2]).not.toHaveClass('is-complete')
  })

  it('marks no step complete when the flow is on its first step', () => {
    const { container } = render(<WizardProgress currentStepIndex={0} steps={STEPS} />)

    const markers = Array.from(container.querySelectorAll<HTMLElement>('.wizard-progress-marker'))
    expect(markers.map((m) => m.textContent)).toEqual(['1', '2', '3'])
    expect(container.querySelector('.is-complete')).toBeNull()
  })

  it('keeps every marker hidden from assistive tech', () => {
    const { container } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    for (const marker of Array.from(container.querySelectorAll('.wizard-progress-marker'))) {
      expect(marker).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('keeps future steps marked with their 1-based position', () => {
    const { container } = render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    const markers = Array.from(container.querySelectorAll<HTMLElement>('.wizard-progress-marker'))
    expect(markers.map((m) => m.textContent)).toEqual(['✓', '2', '3'])
  })
})

describe('WizardProgress - boundary and invalid indices', () => {
  it('throws for an empty step list instead of rendering a phantom first step', () => {
    // The caption is built from `currentStepIndex + 1` and would claim "Step 1
    // of 0", but `currentStep.label` is evaluated first and fails.
    expect(() => render(<WizardProgress currentStepIndex={0} steps={[]} />)).toThrow(TypeError)
  })

  it('renders a single-step flow as "Step 1 of 1"', () => {
    const one = [STEPS[0]]
    const { container } = render(<WizardProgress currentStepIndex={0} steps={one} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 1 of 1')
    expect(announcement()).toHaveTextContent('Step 1 of 1: Credentials')
    expect(items(container)).toHaveLength(1)
  })

  it('throws rather than rendering a stale step when the index is past the end', () => {
    // `steps[currentStepIndex]` is undefined, so dereferencing `currentStep.label`
    // is a hard failure. Callers must clamp the index themselves.
    expect(() => render(<WizardProgress currentStepIndex={3} steps={STEPS} />)).toThrow(TypeError)
  })

  it('throws for a negative index instead of silently wrapping', () => {
    expect(() => render(<WizardProgress currentStepIndex={-1} steps={STEPS} />)).toThrow(TypeError)
  })

  it('does not mutate the steps array it is given', () => {
    const snapshot = JSON.stringify(STEPS)

    render(<WizardProgress currentStepIndex={1} steps={STEPS} />)

    expect(JSON.stringify(STEPS)).toBe(snapshot)
  })

  it('honours a custom step list rather than a module-level constant', () => {
    const custom: Step[] = [
      { id: 'a', label: 'Alpha', detail: 'first' },
      { id: 'b', label: 'Beta', detail: 'second' },
    ]
    const { container } = render(<WizardProgress currentStepIndex={1} steps={custom} />)

    expect(container.querySelector('.wizard-progress-caption')).toHaveTextContent('Step 2 of 2')
    expect(announcement()).toHaveTextContent('Step 2 of 2: Beta')
    expect(items(container)).toHaveLength(2)
  })
})
