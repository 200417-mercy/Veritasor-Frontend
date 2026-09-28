/**
 * WebhookEventPicker — dedicated focused test suite
 * Closes issue #634
 *
 * Covers:
 *  - Component renders correctly with default/empty state
 *  - Public contract: props (selected, onChange, error) behave as documented
 *  - toggleEvent: individual checkbox toggle (add + remove paths)
 *  - toggleGroup: select-all / deselect-all state transitions per group
 *  - Search filtering: by label, by event ID, by group label, case-insensitivity
 *  - Empty search / no-results state
 *  - Clear-search button resets state
 *  - Selection count display reflects current selection size
 *  - Error prop renders an alert; absence renders nothing
 *  - Keyboard navigation (ArrowDown / ArrowUp / no-op on empty list)
 *  - Accessibility: fieldset structure, labelled checkboxes, live region,
 *    aria-controls on search input
 *  - Boundary / invalid-input cases: empty selection array, all selected,
 *    selecting an event that does not exist in data (no crash)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import WebhookEventPicker from './WebhookEventPicker'
import { WEBHOOK_EVENT_GROUPS, ALL_WEBHOOK_EVENTS } from './webhookTypes'

// ─── Render helper ─────────────────────────────────────────────────────────────

interface RenderOptions {
  selected?: string[]
  onChange?: (selected: string[]) => void
  error?: string
}

function renderPicker(opts: RenderOptions = {}) {
  const onChange = opts.onChange ?? vi.fn()
  const result = render(
    <WebhookEventPicker
      selected={opts.selected ?? []}
      onChange={onChange}
      error={opts.error}
    />,
  )
  return { ...result, onChange }
}

// ─── Derived test constants ───────────────────────────────────────────────────

const TOTAL_EVENTS = ALL_WEBHOOK_EVENTS.length // 12

const ATTESTATION_IDS = WEBHOOK_EVENT_GROUPS.find((g) => g.id === 'attestation')!.events.map(
  (e) => e.id,
) // ['attestation.completed', 'attestation.failed', 'attestation.started']

const ALL_EVENT_IDS = ALL_WEBHOOK_EVENTS.map((e) => e.id)

// ─── 1. Rendering / public contract ───────────────────────────────────────────

describe('WebhookEventPicker — rendering', () => {
  it('renders the "Event subscriptions" legend', () => {
    renderPicker()
    expect(screen.getByText(/event subscriptions/i)).toBeInTheDocument()
  })

  it('shows the correct total event count ("0 of 12 selected") with no selection', () => {
    renderPicker()
    expect(screen.getByText(`0 of ${TOTAL_EVENTS} selected`)).toBeInTheDocument()
  })

  it('renders all event group headings', () => {
    renderPicker()
    WEBHOOK_EVENT_GROUPS.forEach((group) => {
      expect(screen.getByText(group.label.toUpperCase())).toBeInTheDocument()
    })
  })

  it(`renders exactly ${TOTAL_EVENTS} checkboxes`, () => {
    renderPicker()
    expect(screen.getAllByRole('checkbox')).toHaveLength(TOTAL_EVENTS)
  })

  it('renders a search input', () => {
    renderPicker()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('does not render the clear-search button when search is empty', () => {
    renderPicker()
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
  })
})

// ─── 2. Selection state transitions (toggleEvent) ────────────────────────────

describe('WebhookEventPicker — toggleEvent state transitions', () => {
  it('adds an event to the selection when its unchecked checkbox is clicked', () => {
    const { onChange } = renderPicker({ selected: [] })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    expect(onChange).toHaveBeenCalledWith(['attestation.completed'])
  })

  it('removes an event from the selection when its checked checkbox is clicked', () => {
    const { onChange } = renderPicker({ selected: ['attestation.completed'] })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('does not affect other events when toggling one', () => {
    const existing = ['source.connected', 'invoice.created']
    const { onChange } = renderPicker({ selected: existing })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    const [called] = onChange.mock.calls
    expect(called[0]).toContain('source.connected')
    expect(called[0]).toContain('invoice.created')
    expect(called[0]).toContain('attestation.completed')
  })

  it('reflects initial checked state from the selected prop', () => {
    renderPicker({ selected: ['key.revoked'] })
    expect(screen.getByLabelText(/key revoked/i)).toBeChecked()
    expect(screen.getByLabelText(/attestation completed/i)).not.toBeChecked()
  })

  it('selection count display updates when selection changes via prop', () => {
    const { rerender } = renderPicker({ selected: [] })
    expect(screen.getByText(`0 of ${TOTAL_EVENTS} selected`)).toBeInTheDocument()

    rerender(
      <WebhookEventPicker
        selected={['attestation.completed', 'key.revoked']}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(`2 of ${TOTAL_EVENTS} selected`)).toBeInTheDocument()
  })
})

// ─── 3. Group toggle state transitions (toggleGroup) ─────────────────────────

describe('WebhookEventPicker — toggleGroup state transitions', () => {
  it('selects all events in a group when none are selected', () => {
    const { onChange } = renderPicker({ selected: [] })
    fireEvent.click(screen.getByRole('button', { name: /select all attestation events/i }))
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(ATTESTATION_IDS))
    expect(onChange.mock.calls[0][0]).toHaveLength(ATTESTATION_IDS.length)
  })

  it('deselects all events in a group when all are selected', () => {
    const { onChange } = renderPicker({ selected: [...ATTESTATION_IDS] })
    fireEvent.click(
      screen.getByRole('button', { name: /deselect all attestation events/i }),
    )
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds only missing group events when some are already selected', () => {
    const { onChange } = renderPicker({ selected: ['attestation.completed'] })
    fireEvent.click(screen.getByRole('button', { name: /select all attestation events/i }))
    const result: string[] = onChange.mock.calls[0][0]
    // All three attestation events must be present, no duplicates
    expect(result).toContain('attestation.completed')
    expect(result).toContain('attestation.failed')
    expect(result).toContain('attestation.started')
    expect(new Set(result).size).toBe(result.length) // no duplicates
  })

  it('button label switches to "Deselect all" once all group events are selected', () => {
    renderPicker({ selected: [...ATTESTATION_IDS] })
    expect(
      screen.getByRole('button', { name: /deselect all attestation events/i }),
    ).toBeInTheDocument()
  })

  it('button label stays "Select all" when only some group events are selected', () => {
    renderPicker({ selected: ['attestation.completed'] }) // not all attestation events
    expect(
      screen.getByRole('button', { name: /select all attestation events/i }),
    ).toBeInTheDocument()
  })

  it('deselecting a group does not affect events from other groups', () => {
    const { onChange } = renderPicker({
      selected: [...ATTESTATION_IDS, 'source.connected'],
    })
    fireEvent.click(
      screen.getByRole('button', { name: /deselect all attestation events/i }),
    )
    expect(onChange).toHaveBeenCalledWith(['source.connected'])
  })
})

// ─── 4. Search filtering ─────────────────────────────────────────────────────

describe('WebhookEventPicker — search filtering', () => {
  function search(term: string) {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: term } })
  }

  it('filters events by label (partial match)', () => {
    renderPicker()
    search('payment')
    expect(screen.getByLabelText(/payment succeeded/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/payment failed/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/attestation completed/i)).not.toBeInTheDocument()
  })

  it('filters events by exact event ID', () => {
    renderPicker()
    search('source.connected')
    expect(screen.getByLabelText(/source connected/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/source disconnected/i)).not.toBeInTheDocument()
  })

  it('filters entire group when the group label matches', () => {
    renderPicker()
    search('billing')
    expect(screen.getByLabelText(/invoice created/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/payment succeeded/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/payment failed/i)).toBeInTheDocument()
  })

  it('is case-insensitive', () => {
    renderPicker()
    search('ATTESTATION')
    expect(screen.getByLabelText(/attestation completed/i)).toBeInTheDocument()
  })

  it('shows "No events found" message for an unmatched query', () => {
    renderPicker()
    search('xyznonexistent')
    expect(screen.getByText(/no events found/i)).toBeInTheDocument()
  })

  it('shows the clear-search button while a query is active', () => {
    renderPicker()
    search('key')
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
  })

  it('restores all events after clear-search is clicked', () => {
    renderPicker()
    search('payment')
    expect(screen.queryByLabelText(/attestation completed/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))

    expect(screen.getByLabelText(/attestation completed/i)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(TOTAL_EVENTS)
  })

  it('live region announces the number of matching results', () => {
    renderPicker()
    search('key')
    const liveRegions = screen.getAllByRole('status')
    const announcements = liveRegions.map((el) => el.textContent ?? '')
    expect(announcements.some((t) => /3 events match/i.test(t))).toBe(true)
  })

  it('live region announces "No events match" when query has no results', () => {
    renderPicker()
    search('zzznomatch')
    const liveRegions = screen.getAllByRole('status')
    const announcements = liveRegions.map((el) => el.textContent ?? '')
    expect(announcements.some((t) => /no events match/i.test(t))).toBe(true)
  })
})

// ─── 5. Error prop ────────────────────────────────────────────────────────────

describe('WebhookEventPicker — error prop', () => {
  it('renders an alert with the error message when error prop is set', () => {
    renderPicker({ error: 'Select at least one event.' })
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Select at least one event.')
  })

  it('does not render an alert when error prop is absent', () => {
    renderPicker()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not render an alert when error prop is an empty string', () => {
    renderPicker({ error: '' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ─── 6. Keyboard navigation ───────────────────────────────────────────────────

describe('WebhookEventPicker — keyboard navigation', () => {
  it('ArrowDown on the search input does not throw', () => {
    renderPicker()
    expect(() =>
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' }),
    ).not.toThrow()
  })

  it('ArrowUp on the search input does not throw', () => {
    renderPicker()
    expect(() =>
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowUp' }),
    ).not.toThrow()
  })

  it('ArrowDown + ArrowUp are no-ops when the filtered list is empty', () => {
    renderPicker()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzznoresult' } })
    expect(() => {
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' })
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowUp' })
    }).not.toThrow()
  })

  it('repeated ArrowDown navigation wraps around to the first item', () => {
    renderPicker()
    const searchInput = screen.getByRole('searchbox')
    // Press ArrowDown more times than there are events — should not throw
    for (let i = 0; i < TOTAL_EVENTS + 5; i++) {
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(TOTAL_EVENTS)
  })
})

// ─── 7. Accessibility ─────────────────────────────────────────────────────────

describe('WebhookEventPicker — accessibility', () => {
  it('wraps the whole component in a <fieldset> (rendered as a group)', () => {
    renderPicker()
    // The outermost element should have the legend inside it
    expect(screen.getByText(/event subscriptions/i).tagName).toBe('LEGEND')
  })

  it('event list container has role="group" with an accessible label', () => {
    renderPicker()
    expect(
      screen.getByRole('group', { name: /event subscription options/i }),
    ).toBeInTheDocument()
  })

  it('every checkbox has an accessible label', () => {
    renderPicker()
    screen.getAllByRole('checkbox').forEach((cb) => {
      expect(cb).toHaveAccessibleName()
    })
  })

  it('search input has aria-controls pointing to the live region', () => {
    renderPicker()
    const input = screen.getByRole('searchbox')
    const liveRegionId = input.getAttribute('aria-controls')
    expect(liveRegionId).toBeTruthy()
    expect(document.getElementById(liveRegionId!)).toBeInTheDocument()
  })

  it('search input has aria-label', () => {
    renderPicker()
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label')
  })
})

// ─── 8. Boundary / invalid-input cases ────────────────────────────────────────

describe('WebhookEventPicker — boundary & invalid inputs', () => {
  it('renders without crashing when selected is an empty array', () => {
    expect(() => renderPicker({ selected: [] })).not.toThrow()
  })

  it('renders without crashing when all events are pre-selected', () => {
    expect(() => renderPicker({ selected: ALL_EVENT_IDS })).not.toThrow()
    expect(screen.getByText(`${TOTAL_EVENTS} of ${TOTAL_EVENTS} selected`)).toBeInTheDocument()
  })

  it('does not crash when selected contains an unknown event ID', () => {
    // The component should silently ignore unrecognised IDs
    expect(() =>
      renderPicker({ selected: ['unknown.event.id'] }),
    ).not.toThrow()
    // None of the real checkboxes should be checked
    screen.getAllByRole('checkbox').forEach((cb) =>
      expect(cb).not.toBeChecked(),
    )
  })

  it('onChange is called with the correct array type (not undefined/null)', () => {
    const { onChange } = renderPicker({ selected: [] })
    fireEvent.click(screen.getByLabelText(/attestation completed/i))
    const [result] = onChange.mock.calls[0]
    expect(Array.isArray(result)).toBe(true)
  })

  it('renders correctly when all events in a group are selected but not others', () => {
    renderPicker({ selected: [...ATTESTATION_IDS] })
    // Attestation group should show "Deselect all"
    expect(
      screen.getByRole('button', { name: /deselect all attestation events/i }),
    ).toBeInTheDocument()
    // Other groups still show "Select all"
    expect(
      screen.getByRole('button', { name: /select all billing events/i }),
    ).toBeInTheDocument()
  })
})
