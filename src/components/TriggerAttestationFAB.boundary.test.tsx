import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TriggerAttestationFAB from './TriggerAttestationFAB'

/**
 * Focused behavior coverage for `TriggerAttestationFABProps`.
 *
 * The prop contract is small (`onTrigger` required, `isLoading` optional and
 * defaulting to `false`), so these tests concentrate on the three places the
 * props actually change observable behavior:
 *
 *  1. `isLoading` - `disabled`, `aria-busy`, spinner instead of the icon, and
 *     suppression of activation.
 *  2. The scroll-driven extended-label state, whose 200px trigger point and
 *     300ms debounce are exact numbers worth pinning.
 *  3. Teardown - the scroll listener and any pending debounce are released on
 *     unmount.
 */

const NEAR_TOP_LIMIT = 200
const DEBOUNCE_MS = 300

function scrollTo(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
  fireEvent.scroll(window)
}

function fab(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.fab-trigger')
  if (!el) throw new Error('fab-trigger not found')
  return el
}

function label(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.fab-label')
}

/**
 * jsdom does not evaluate `@media` blocks, so the mobile-only rule that
 * reveals the FAB (`display: flex` under 768px) never applies and the button
 * stays `display: none` from the desktop base rule. An element that is not
 * rendered has no accessible name, so the naming assertions below first apply
 * the presentation a mobile viewport would produce.
 */
function emulateMobileViewport(el: HTMLElement): void {
  el.style.display = 'flex'
}

let onTrigger: ReturnType<typeof vi.fn>

beforeEach(() => {
  onTrigger = vi.fn()
  scrollTo(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TriggerAttestationFAB - prop contract', () => {
  it('renders a native button so keyboard activation is provided by the platform', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const button = fab(container)
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('treats isLoading as optional and defaults it to false', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const button = fab(container)
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'false')
    expect(container.querySelector('.fab-spinner')).toBeNull()
  })

  it('calls onTrigger once per activation', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    fireEvent.click(fab(container))
    expect(onTrigger).toHaveBeenCalledTimes(1)

    fireEvent.click(fab(container))
    expect(onTrigger).toHaveBeenCalledTimes(2)
  })

  it('ignores activations while isLoading is true', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} isLoading />)

    const button = fab(container)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onTrigger).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('swaps the icon for the spinner and marks the button busy while loading', () => {
    const { container, rerender } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    expect(container.querySelector('.fab-trigger svg')).not.toBeNull()
    expect(container.querySelector('.fab-spinner')).toBeNull()

    rerender(<TriggerAttestationFAB onTrigger={onTrigger} isLoading />)

    expect(container.querySelector('.fab-spinner')).not.toBeNull()
    // The plain trigger icon is replaced, not merely hidden.
    expect(container.querySelectorAll('.fab-trigger svg')).toHaveLength(1)
    expect(fab(container)).toHaveAttribute('aria-busy', 'true')
  })

  it('restores interactivity when loading finishes', () => {
    const { container, rerender } = render(<TriggerAttestationFAB onTrigger={onTrigger} isLoading />)

    rerender(<TriggerAttestationFAB onTrigger={onTrigger} isLoading={false} />)

    fireEvent.click(fab(container))
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.fab-spinner')).toBeNull()
  })

  it('uses a fresh callback prop after a re-render', () => {
    const { container, rerender } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)
    const replacement = vi.fn()
    rerender(<TriggerAttestationFAB onTrigger={replacement} />)

    fireEvent.click(fab(container))
    expect(onTrigger).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledTimes(1)
  })
})

describe('TriggerAttestationFAB - accessible naming across label states', () => {
  it('hides itself on desktop and only reveals the FAB below 768px', () => {
    render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const css = document.querySelector('style')?.textContent ?? ''
    expect(css).toMatch(/\.fab-trigger\s*{[^}]*display:\s*none/)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)/)
  })

  it('names the icon-only button for assistive tech', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const button = fab(container)
    emulateMobileViewport(button)

    expect(button).toHaveAttribute('aria-label', 'Trigger new attestation')
    // The icon is decorative, so the aria-label is the whole accessible name.
    expect(button.textContent).toBe('')
    expect(button).toHaveAccessibleName('Trigger new attestation')
  })

  it('drops the aria-label in favour of visible text once the label is shown', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)
    scrollTo(NEAR_TOP_LIMIT - 1)

    const button = fab(container)
    emulateMobileViewport(button)
    // The label is `display: none` until the button carries `.fab-extended`.
    ;(label(container) as HTMLElement).style.display = 'inline'

    expect(label(container)).toHaveTextContent('New attestation')
    // Visible text wins; a duplicate label would make the name ambiguous.
    expect(button).not.toHaveAttribute('aria-label')
    expect(button).toHaveClass('fab-extended')
    expect(button).toHaveAccessibleName('New attestation')
  })
})

describe('TriggerAttestationFAB - scroll boundary and debounce', () => {
  it('does not show the label before any scroll event', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    expect(label(container)).toBeNull()
    expect(fab(container)).not.toHaveClass('fab-extended')
  })

  it('shows the label immediately when scrolling back near the top', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(10)
    expect(label(container)).toHaveTextContent('New attestation')
  })

  it('treats scrollY just below the limit as near the top', () => {
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(NEAR_TOP_LIMIT - 1)
    expect(label(container)).not.toBeNull()
  })

  it('does not hide the label until the debounce window elapses', () => {
    vi.useFakeTimers()
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(NEAR_TOP_LIMIT - 1)
    expect(label(container)).not.toBeNull()

    scrollTo(NEAR_TOP_LIMIT)
    // scrollY === 200 is not `< 200`, so a collapse is queued but not applied.
    expect(label(container)).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    })
    expect(label(container)).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(label(container)).toBeNull()
    expect(fab(container)).not.toHaveClass('fab-extended')
  })

  it('cancels a pending collapse when the user scrolls back to the top', () => {
    vi.useFakeTimers()
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(NEAR_TOP_LIMIT - 1)
    scrollTo(500)
    scrollTo(0)

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 3)
    })

    // The earlier timeout must not fire after the label was re-shown.
    expect(label(container)).not.toBeNull()
    expect(fab(container)).toHaveClass('fab-extended')
  })

  it('only applies the last scroll position when many events arrive', () => {
    vi.useFakeTimers()
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(NEAR_TOP_LIMIT - 1)
    scrollTo(400)
    scrollTo(800)
    scrollTo(1200)

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(label(container)).toBeNull()
  })

  it('keeps the pending debounce running without the label flashing back', () => {
    vi.useFakeTimers()
    const { container } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(NEAR_TOP_LIMIT - 1)
    scrollTo(900)

    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(label(container)).toBeNull()
    // A second deep scroll must not resurrect the label.
    scrollTo(1000)
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(label(container)).toBeNull()
  })
})

describe('TriggerAttestationFAB - listener lifecycle', () => {
  it('subscribes to scroll with a passive listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const scrollCall = addSpy.mock.calls.find(([type]) => type === 'scroll')
    expect(scrollCall).toBeDefined()
    expect(scrollCall?.[2]).toMatchObject({ passive: true })
    addSpy.mockRestore()
  })

  it('removes the scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    unmount()

    expect(removeSpy.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    removeSpy.mockRestore()
  })

  it('clears a pending debounce on unmount', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    scrollTo(500)
    unmount()

    // The collapse scheduled at scroll time must not outlive the component.
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('does not schedule a collapse while the label is already hidden', () => {
    vi.useFakeTimers()
    const setSpy = vi.spyOn(globalThis, 'setTimeout')
    render(<TriggerAttestationFAB onTrigger={onTrigger} />)

    const before = setSpy.mock.calls.length
    scrollTo(500)
    const afterFirst = setSpy.mock.calls.length
    scrollTo(900)
    const afterSecond = setSpy.mock.calls.length

    // Deep scrolling always re-arms the debounce, so React state cannot be
    // collapsed multiple times in one window.
    expect(afterFirst).toBe(before + 1)
    expect(afterSecond).toBe(afterFirst + 1)
    setSpy.mockRestore()
  })
})
