import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AttestationConfirmModal, {
  AttestationDetails,
} from '../components/AttestationConfirmModal'

/**
 * Focused regression suite for the branch at
 * `src/components/AttestationConfirmModal.tsx:59`.
 *
 * Line 59 is the open-guard of the focus-trap effect:
 *
 *   useEffect(() => {
 *     if (!open) return        // <-- line 59
 *     ...
 *     document.addEventListener('keydown', handleKeyDown)
 *     return () => document.removeEventListener('keydown', handleKeyDown)
 *   }, [open, onClose])
 *
 * and the sibling effect owns the `triggerRef` branch:
 *
 *   if (open) {
 *     triggerRef.current = document.activeElement as HTMLElement
 *     dialogRef.current!.focus()
 *   } else {
 *     triggerRef.current?.focus()   // no-op when no trigger was captured
 *   }
 *
 * Neither branch is observable through a plain `getByRole('dialog')` query, so
 * this suite pins their real contract:
 *
 * - the guard must abort *before* subscribing (no listener while closed, and no
 *   `dialogRef.current!.querySelectorAll(...)` dereference of an unmounted
 *   dialog), while the open pass still installs exactly one trap;
 * - `triggerRef` must be captured on every open, restored on close, and the
 *   optional-chain path must stay a deterministic no-op when the modal is
 *   mounted closed or the trigger has been detached.
 */

const DETAILS: AttestationDetails = {
  source: 'stripe',
  period: '2026-08',
  recordCount: 1234,
  merkleRoot: '0xabcdef1234567890abcdef1234567890abcdef12',
}

/** Dispatches a bubbling, cancelable keydown on `document` (where the trap listens). */
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

/** Focusable stand-in for the page control that opens the dialog. */
function addControl(label: string): HTMLButtonElement {
  const control = document.createElement('button')
  control.type = 'button'
  control.textContent = label
  document.body.appendChild(control)
  return control
}

/** `document.addEventListener('keydown', ...)` calls recorded by a spy. */
function keydownCalls(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter(([type]) => type === 'keydown')
}

describe('AttestationConfirmModal — the abort branch of AttestationConfirmModal.tsx:59', () => {
  it('does not subscribe to document keydown while the dialog is closed', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    try {
      render(
        <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )

      expect(keydownCalls(addSpy)).toHaveLength(0)
    } finally {
      addSpy.mockRestore()
    }
  })

  it('leaves Tab and Escape untouched while closed instead of dereferencing the unmounted dialog', () => {
    const onClose = vi.fn()
    render(
      <AttestationConfirmModal
        open={false}
        onClose={onClose}
        onConfirm={vi.fn()}
        details={DETAILS}
      />,
    )

    // `dialogRef.current` is null while closed, so an effect that failed to
    // abort here would throw on `dialogRef.current!.querySelectorAll(...)`.
    expect(dispatchKey('Tab').defaultPrevented).toBe(false)
    expect(dispatchKey('Tab', { shiftKey: true }).defaultPrevented).toBe(false)
    expect(dispatchKey('Escape').defaultPrevented).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not move focus and does not arm the trap while closed', () => {
    const outside = addControl('Outside control')
    outside.focus()
    const addSpy = vi.spyOn(document, 'addEventListener')

    try {
      render(
        <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )

      expect(outside).toHaveFocus()

      dispatchKey('Tab')

      expect(outside).toHaveFocus()
      expect(keydownCalls(addSpy)).toHaveLength(0)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      addSpy.mockRestore()
      outside.remove()
    }
  })

  it('aborts on `open` alone, regardless of the loading, details or error props', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    try {
      render(
        <AttestationConfirmModal
          open={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          isLoading
          details={DETAILS}
          error="Attestation submission failed"
        />,
      )

      expect(keydownCalls(addSpy)).toHaveLength(0)
      expect(dispatchKey('Escape').defaultPrevented).toBe(false)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      addSpy.mockRestore()
    }
  })

  it('never re-attaches the listener on further closed renders of an opened dialog', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    try {
      const onClose = vi.fn()
      const onConfirm = vi.fn()
      const { rerender } = render(
        <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />,
      )
      expect(keydownCalls(addSpy)).toHaveLength(1)

      rerender(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
      )
      rerender(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
      )

      // The cleanup removed the trap on close and the guard keeps it removed.
      expect(keydownCalls(addSpy)).toHaveLength(1)
    } finally {
      addSpy.mockRestore()
    }
  })
})

describe('AttestationConfirmModal — the open pass through AttestationConfirmModal.tsx:59', () => {
  it('installs exactly one keydown listener while open and removes the same handler on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    try {
      const { unmount } = render(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )

      const added = keydownCalls(addSpy)
      expect(added).toHaveLength(1)

      unmount()

      const removed = keydownCalls(removeSpy)
      expect(removed).toHaveLength(1)
      expect(removed[0][1]).toBe(added[0][1])
    } finally {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  it('traps Tab while open and stops trapping once the guard takes over', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <AttestationConfirmModal
        open
        onClose={onClose}
        onConfirm={onConfirm}
        details={DETAILS}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Confirm & Attest' })
    confirmButton.focus()
    expect(dispatchKey('Tab').defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()

    rerender(
      <AttestationConfirmModal
        open={false}
        onClose={onClose}
        onConfirm={onConfirm}
        details={DETAILS}
      />,
    )

    expect(dispatchKey('Tab').defaultPrevented).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('subscribes again when the dialog is reopened (the guard is per pass, not one-shot)', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
    )

    expect(dispatchKey('Tab').defaultPrevented).toBe(false)

    rerender(<AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />)

    screen.getByRole('button', { name: 'Confirm & Attest' }).focus()

    expect(dispatchKey('Tab').defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
  })
})

describe('AttestationConfirmModal — triggerRef capture and restore', () => {
  it('captures the focused trigger on open and hands focus back on close', () => {
    const trigger = addControl('Open attestation')
    trigger.focus()
    expect(trigger).toHaveFocus()

    try {
      const onClose = vi.fn()
      const onConfirm = vi.fn()
      const { rerender } = render(
        <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />,
      )
      expect(screen.getByRole('dialog')).toHaveFocus()

      rerender(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    } finally {
      trigger.remove()
    }
  })

  it('re-captures the newest trigger on every open instead of reusing a stale reference', () => {
    const firstTrigger = addControl('First trigger')
    const secondTrigger = addControl('Second trigger')
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const closed = (
      <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />
    )

    try {
      firstTrigger.focus()
      const { rerender } = render(
        <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />,
      )
      expect(screen.getByRole('dialog')).toHaveFocus()

      rerender(closed)
      expect(firstTrigger).toHaveFocus()

      secondTrigger.focus()
      rerender(<AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />)
      expect(screen.getByRole('dialog')).toHaveFocus()

      rerender(closed)

      expect(secondTrigger).toHaveFocus()
      expect(firstTrigger).not.toHaveFocus()
    } finally {
      firstTrigger.remove()
      secondTrigger.remove()
    }
  })

  it('treats a missing trigger as a deterministic no-op when the dialog mounts closed', () => {
    const outside = addControl('Outside control')
    outside.focus()

    try {
      // triggerRef.current is still null here, so the optional chain in the
      // `else` branch is the only thing keeping this mount from throwing.
      expect(() =>
        render(
          <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
        ),
      ).not.toThrow()

      expect(document.activeElement).toBe(outside)
    } finally {
      outside.remove()
    }
  })

  it('does not throw when the trigger is detached before the dialog closes', () => {
    const trigger = addControl('Ephemeral trigger')
    trigger.focus()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()

    trigger.remove()

    expect(() =>
      rerender(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
      ),
    ).not.toThrow()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).not.toBe(trigger)
    expect(onClose).not.toHaveBeenCalled()
  })
})

