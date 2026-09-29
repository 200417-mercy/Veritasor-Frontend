import { render, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AttestationConfirmModal from '../components/AttestationConfirmModal'

/**
 * Focused regression suite for the `handleKeyDown` Escape branch at
 * `src/components/AttestationConfirmModal.tsx:62`:
 *
 *   if (e.key === 'Escape') {
 *     e.preventDefault()
 *     onClose()
 *     return
 *   }
 *
 * The sibling `src/test/attestation-confirm-modal.test.tsx` covers the
 * rendered UI; this file pins the *observable contract* of the branch itself:
 * the default action is suppressed, dismissal is exact-once, the handler only
 * fires while the dialog is mounted/open, and the branch is independent of the
 * loading state.
 */

function dispatchEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    document.dispatchEvent(event)
  })
  return event
}

function dispatchKey(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    document.dispatchEvent(event)
  })
  return event
}

describe('AttestationConfirmModal — Escape branch (line 62)', () => {
  it('suppresses the default action for Escape', () => {
    render(<AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />)

    const event = dispatchEscape()

    expect(event.defaultPrevented).toBe(true)
  })

  it('calls onClose exactly once per Escape keydown', () => {
    const onClose = vi.fn()
    render(<AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />)

    dispatchEscape()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when Escape is pressed', () => {
    const onConfirm = vi.fn()
    render(<AttestationConfirmModal open onClose={vi.fn()} onConfirm={onConfirm} />)

    dispatchEscape()

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not suppress the default action for non-Escape keys', () => {
    render(
      <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
    )

    expect(dispatchKey('Enter').defaultPrevented).toBe(false)
    expect(dispatchKey('a').defaultPrevented).toBe(false)
    expect(dispatchKey('Escape', { key: 'Esc' }).defaultPrevented).toBe(false)
  })

  it('is case-sensitive: lowercase "escape" does not dismiss', () => {
    const onClose = vi.fn()
    render(<AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />)

    dispatchKey('escape')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('still dismisses while the confirm request is in flight (isLoading)', () => {
    const onClose = vi.fn()
    render(
      <AttestationConfirmModal
        open
        onClose={onClose}
        onConfirm={vi.fn()}
        isLoading
      />,
    )

    dispatchEscape()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stops listening after the modal is closed via rerender', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
    )

    rerender(
      <AttestationConfirmModal open={false} onClose={onClose} onConfirm={vi.fn()} />,
    )
    dispatchEscape()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('re-subscribes when the modal is reopened', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <AttestationConfirmModal open={false} onClose={onClose} onConfirm={vi.fn()} />,
    )

    dispatchEscape()
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
    )
    dispatchEscape()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('removes the document listener on unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
    )

    unmount()
    dispatchEscape()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses exactly once even when Escape is repeated', () => {
    const onClose = vi.fn()
    render(<AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />)

    dispatchEscape()
    dispatchEscape()
    dispatchEscape()

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('treats a modified Escape (shiftKey) the same as a plain Escape', () => {
    const onClose = vi.fn()
    render(<AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />)

    const event = dispatchKey('Escape', { shiftKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
