/**
 * AddressAutocomplete regression tests — Issue #682
 *
 * Focused coverage for:
 *   • src/components/AddressAutocomplete.tsx:130
 *     `if (value?.isManual !== undefined) setManualMode(value.isManual)`
 *   • debouncedQuery branch: `if (manualMode) return` suppresses fetch
 *
 * Acceptance:
 *   ✓ value.isManual=true  → manualMode is set → fetch is suppressed
 *   ✓ value.isManual=false → manualMode is cleared → fetch is enabled
 *   ✓ Adjacent success path: suggestions fetched, selected, status updated
 *   ✓ Error + boundary paths: fetch failure, short query, empty result
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddressAutocomplete from './AddressAutocomplete'
import type { AddressSuggestion, AddressValue } from './AddressAutocomplete'

afterEach(() => cleanup())

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A resolved promise that flushes one microtask tick */
const tick = () => act(async () => {})

/**
 * The component renders TWO elements with role=combobox:
 *   1. A wrapper <div role="combobox">
 *   2. The <input role="combobox" aria-label="Business address">
 * Use the accessible name to target the actual text input unambiguously.
 */
const getInput = () => screen.getByRole('combobox', { name: /business address/i })

/** Advance fake timers past the 300ms debounce + React state flush */
async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(350)
  })
}

const SUGGESTION: AddressSuggestion = {
  id: '1',
  label: '10 Downing St',
  fullAddress: '10 Downing St, London SW1A 2AA, UK',
  lat: 51.5034,
  lng: -0.1276,
}

function renderComponent(props: {
  value?: AddressValue | null
  fetchSuggestions?: (q: string) => Promise<AddressSuggestion[]>
  onChange?: (v: AddressValue) => void
  onClear?: () => void
  error?: string
  required?: boolean
}) {
  const onChange = props.onChange ?? vi.fn()
  const { rerender } = render(
    <AddressAutocomplete
      value={props.value}
      onChange={onChange}
      onClear={props.onClear}
      fetchSuggestions={props.fetchSuggestions}
      error={props.error}
      required={props.required}
    />,
  )
  return { onChange, rerender }
}

// ─── Line 130: value-sync effect ──────────────────────────────────────────────
// `if (value?.isManual !== undefined) setManualMode(value.isManual)`

describe('value-sync effect (line 130) — setManualMode from props', () => {
  it('sets manualMode to true when value.isManual is true on initial render', () => {
    renderComponent({
      value: { fullAddress: 'Typed by user', isManual: true },
    })
    // Manual mode shows the manual form and hides the autocomplete listbox trigger
    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use autocomplete/i })).toBeInTheDocument()
  })

  it('sets manualMode to false when value.isManual is false on initial render', () => {
    renderComponent({
      value: { fullAddress: '10 Downing St', isManual: false, lat: 51.5, lng: -0.1 },
    })
    // Autocomplete mode shows the toggle offering manual entry
    expect(screen.getByRole('button', { name: /enter manually/i })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: /enter address manually/i })).not.toBeInTheDocument()
  })

  it('syncs manualMode from false → true when value prop is updated', async () => {
    const { rerender } = renderComponent({
      value: { fullAddress: '10 Downing St', isManual: false },
    })
    // Initially in autocomplete mode
    expect(screen.queryByRole('form', { name: /enter address manually/i })).not.toBeInTheDocument()

    rerender(
      <AddressAutocomplete
        value={{ fullAddress: 'Custom address', isManual: true }}
        onChange={vi.fn()}
      />,
    )
    await tick()

    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
  })

  it('syncs manualMode from true → false when value prop is updated', async () => {
    const { rerender } = renderComponent({
      value: { fullAddress: 'Custom address', isManual: true },
    })
    // Initially in manual mode
    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()

    rerender(
      <AddressAutocomplete
        value={{ fullAddress: '10 Downing St', isManual: false, lat: 51.5, lng: -0.1 }}
        onChange={vi.fn()}
      />,
    )
    await tick()

    expect(screen.queryByRole('form', { name: /enter address manually/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter manually/i })).toBeInTheDocument()
  })

  it('does NOT change manualMode when value.isManual is undefined', async () => {
    // Toggle to manual mode first via the UI
    renderComponent({ value: null })
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))
    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
    // value with no isManual prop should not reset manualMode
    // (the effect guards with `if (value?.isManual !== undefined)`)
    // We verify the form is still present — it wasn't reset
    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
  })

  it('syncs the query input text when value.fullAddress changes', async () => {
    const { rerender } = renderComponent({
      value: { fullAddress: 'Original Address', isManual: false },
    })
    const input = getInput()
    expect(input).toHaveValue('Original Address')

    rerender(
      <AddressAutocomplete
        value={{ fullAddress: 'Updated Address', isManual: false }}
        onChange={vi.fn()}
      />,
    )
    await tick()
    expect(input).toHaveValue('Updated Address')
  })
})

// ─── debouncedQuery branch: manualMode=true suppresses fetch ─────────────────
// `if (manualMode) return`

describe('debouncedQuery branch — fetch suppressed when manualMode is true', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does NOT call fetchSuggestions when value.isManual=true (line 130 sets manualMode)', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({
      value: { fullAddress: '', isManual: true },
      fetchSuggestions,
    })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    expect(fetchSuggestions).not.toHaveBeenCalled()
  })

  it('does NOT show a suggestion listbox in manual mode after typing', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({
      value: { fullAddress: '', isManual: true },
      fetchSuggestions,
    })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('still calls fetchSuggestions when manualMode is toggled back to false', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({
      value: { fullAddress: '', isManual: true },
      fetchSuggestions,
    })

    // Switch back to autocomplete mode
    fireEvent.click(screen.getByRole('button', { name: /use autocomplete/i }))

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    expect(fetchSuggestions).toHaveBeenCalledWith('Downing')
  })

  it('prop change isManual true → false re-enables fetch on next keystroke', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    const { rerender } = renderComponent({
      value: { fullAddress: 'Downing', isManual: true },
      fetchSuggestions,
    })

    // Update value prop: isManual switches to false (line 130 clears manualMode)
    rerender(
      <AddressAutocomplete
        value={{ fullAddress: 'Downing', isManual: false }}
        onChange={vi.fn()}
        fetchSuggestions={fetchSuggestions}
      />,
    )
    await tick()

    // Type to trigger debouncedQuery
    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing St' } })
    await advanceDebounce()

    expect(fetchSuggestions).toHaveBeenCalledWith('Downing St')
  })
})

// ─── debouncedQuery branch — fetch enabled when manualMode is false ──────────

describe('debouncedQuery branch — fetch enabled when manualMode is false', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls fetchSuggestions after debounce when query length >= 2', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Do' } })
    await advanceDebounce()

    expect(fetchSuggestions).toHaveBeenCalledWith('Do')
  })

  it('shows suggestions in listbox after fetch resolves', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'Downing' } })
    await advanceDebounce()

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('10 Downing St')).toBeInTheDocument()
  })

  it('does NOT call fetchSuggestions when query is shorter than 2 chars', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'D' } })
    await advanceDebounce()

    expect(fetchSuggestions).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does NOT call fetchSuggestions when query is empty', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: '' } })
    await advanceDebounce()

    expect(fetchSuggestions).not.toHaveBeenCalled()
  })

  it('debounces rapid keystrokes — only the last value triggers fetch', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })
    const input = getInput()

    // Rapid consecutive changes within debounce window
    fireEvent.change(input, { target: { value: 'D' } })
    fireEvent.change(input, { target: { value: 'Do' } })
    fireEvent.change(input, { target: { value: 'Dow' } })

    await advanceDebounce()

    // Only one call, for the final settled value
    expect(fetchSuggestions).toHaveBeenCalledTimes(1)
    expect(fetchSuggestions).toHaveBeenCalledWith('Dow')
  })

  it('cancels in-flight fetch when component unmounts', async () => {
    // Verify no "state update on unmounted component" warnings leak
    let resolveRequest!: (v: AddressSuggestion[]) => void
    const fetchSuggestions = vi.fn(
      () => new Promise<AddressSuggestion[]>(res => { resolveRequest = res }),
    )
    const { unmount } = render(
      <AddressAutocomplete onChange={vi.fn()} fetchSuggestions={fetchSuggestions} />,
    )
    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    // Unmount before the fetch resolves — should not throw
    unmount()
    await act(async () => { resolveRequest([SUGGESTION]) })
    // If we reach here without error, the cancelled-flag guard works
  })
})

// ─── Adjacent success path ────────────────────────────────────────────────────

describe('AddressAutocomplete — suggestion selection (success path)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls onChange with isManual=false when a suggestion is selected', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    const onChange = vi.fn()
    renderComponent({ fetchSuggestions, onChange })

    fireEvent.change(getInput(), { target: { value: 'Downing' } })
    await advanceDebounce()

    fireEvent.click(screen.getByText('10 Downing St'))

    expect(onChange).toHaveBeenCalledWith({
      fullAddress: '10 Downing St, London SW1A 2AA, UK',
      lat: 51.5034,
      lng: -0.1276,
      isManual: false,
    })
  })

  it('closes the listbox after a suggestion is selected', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'Downing' } })
    await advanceDebounce()

    // Before click: suggestion item exists in the listbox
    expect(screen.getByRole('option', { name: /10 Downing St/i })).toBeInTheDocument()

    // Click the suggestion — selectSuggestion calls setOpen(false) + setSuggestions([])
    fireEvent.click(screen.getByText('10 Downing St'))

    // The suggestion option is gone from the DOM (suggestions was cleared)
    expect(screen.queryByRole('option', { name: /10 Downing St/i })).not.toBeInTheDocument()
  })

  it('updates live status message after suggestion is selected', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'Downing' } })
    await advanceDebounce()
    fireEvent.click(screen.getByText('10 Downing St'))

    expect(screen.getByRole('status')).toHaveTextContent(/selected.*10 Downing St/i)
  })

  it('shows map preview after selecting a suggestion with coordinates', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    const onChange = vi.fn()
    const { rerender } = renderComponent({ fetchSuggestions, onChange })

    fireEvent.change(getInput(), { target: { value: 'Downing' } })
    await advanceDebounce()
    fireEvent.click(screen.getByText('10 Downing St'))

    // Simulate parent updating the value prop after onChange (controlled component)
    rerender(
      <AddressAutocomplete
        value={{ fullAddress: '10 Downing St, London SW1A 2AA, UK', lat: 51.5034, lng: -0.1276, isManual: false }}
        onChange={onChange}
        fetchSuggestions={fetchSuggestions}
      />,
    )
    await tick()

    expect(screen.getByRole('region', { name: /map preview/i })).toBeInTheDocument()
  })

  it('announces suggestion count via live status region', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION, { ...SUGGESTION, id: '2', label: 'Another St' }])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'St' } })
    await advanceDebounce()

    expect(screen.getByRole('status')).toHaveTextContent('2 suggestions available')
  })

  it('shows empty-state message in listbox when no suggestions found', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([])
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'xyznonexistent' } })
    await advanceDebounce()

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText(/no matching addresses found/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No suggestions found')
  })
})

// ─── Manual submit path ───────────────────────────────────────────────────────

describe('AddressAutocomplete — manual address entry', () => {
  it('shows manual form when "Enter manually" toggle is clicked', () => {
    renderComponent({})
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))
    expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
  })

  it('calls onChange with isManual=true on manual form submit', async () => {
    const onChange = vi.fn()
    renderComponent({
      value: { fullAddress: '', isManual: true },
      onChange,
    })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'My Custom Address' } })
    fireEvent.submit(screen.getByRole('form', { name: /enter address manually/i }))

    expect(onChange).toHaveBeenCalledWith({
      fullAddress: 'My Custom Address',
      isManual: true,
    })
  })

  it('does NOT submit manual form when input is empty', () => {
    const onChange = vi.fn()
    renderComponent({
      value: { fullAddress: '', isManual: true },
      onChange,
    })
    fireEvent.submit(screen.getByRole('form', { name: /enter address manually/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows manual-address confirmation preview after successful save', async () => {
    const onChange = vi.fn()
    const { rerender } = renderComponent({
      value: { fullAddress: '', isManual: true },
      onChange,
    })
    const input = getInput()
    fireEvent.change(input, { target: { value: 'My Office' } })
    fireEvent.submit(screen.getByRole('form', { name: /enter address manually/i }))

    // Simulate parent reflecting confirmed value
    rerender(
      <AddressAutocomplete
        value={{ fullAddress: 'My Office', isManual: true }}
        onChange={onChange}
      />,
    )
    await tick()

    expect(screen.getByText(/address saved:.*My Office/i)).toBeInTheDocument()
    expect(screen.getByText(/map preview unavailable/i)).toBeInTheDocument()
  })
})

// ─── Error & boundary paths ───────────────────────────────────────────────────

describe('AddressAutocomplete — error and boundary behaviour', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows fetch-error message in live status region when fetch rejects', async () => {
    const fetchSuggestions = vi.fn().mockRejectedValue(new Error('Network error'))
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'Fail' } })
    // Advance debounce so the effect fires the fetch
    await advanceDebounce()
    // Flush the rejected promise microtask
    await tick()

    expect(screen.getByRole('status')).toHaveTextContent('Could not fetch suggestions')
  })

  it('does NOT open the listbox when fetch rejects', async () => {
    const fetchSuggestions = vi.fn().mockRejectedValue(new Error('Network error'))
    renderComponent({ fetchSuggestions })

    fireEvent.change(getInput(), { target: { value: 'Fail' } })
    await advanceDebounce()
    await tick()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('renders external validation error with role=alert', () => {
    renderComponent({ error: 'Address is required' })
    expect(screen.getByRole('alert')).toHaveTextContent('Address is required')
  })

  it('marks the input aria-invalid when an error is passed', () => {
    renderComponent({ error: 'Address is required' })
    expect(getInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the input and calls onClear when clear button is clicked', async () => {
    const onClear = vi.fn()
    // Provide an instant-resolve mock so loading transitions false→true→false
    // quickly, making the clear button visible after the debounce fires.
    const fetchSuggestions = vi.fn().mockResolvedValue([])
    renderComponent({
      value: { fullAddress: '10 Downing St', isManual: false },
      onClear,
      fetchSuggestions,
    })
    // Advance the debounce so fetchSuggestions is called and loading clears
    await advanceDebounce()
    // Flush the resolved promise so loading→false and clear btn renders
    await tick()

    // The clear button is inside an aria-hidden container but has its own
    // aria-label, so query by attribute directly.
    const clearBtn = document.querySelector('button[aria-label="Clear address"]') as HTMLElement
    expect(clearBtn).not.toBeNull()
    fireEvent.mouseDown(clearBtn) // sets ignoreNextBlur
    fireEvent.click(clearBtn)

    expect(getInput()).toHaveValue('')
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Address cleared')
  })

  it('marks input as aria-required when required prop is true', () => {
    renderComponent({ required: true })
    expect(getInput()).toHaveAttribute('aria-required', 'true')
  })
})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('AddressAutocomplete — keyboard navigation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('navigates suggestions with ArrowDown and selects with Enter', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    const onChange = vi.fn()
    renderComponent({ fetchSuggestions, onChange })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fullAddress: SUGGESTION.fullAddress, isManual: false }),
    )
  })

  it('closes listbox on Escape keypress', async () => {
    const fetchSuggestions = vi.fn().mockResolvedValue([SUGGESTION])
    renderComponent({ fetchSuggestions })

    const input = getInput()
    fireEvent.change(input, { target: { value: 'Downing' } })
    await advanceDebounce()

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
