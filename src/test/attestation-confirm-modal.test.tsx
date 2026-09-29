import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AttestationConfirmModal from '../components/AttestationConfirmModal'
import Dashboard from '../pages/Dashboard'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const DEMO_DETAILS = {
  source: 'Stripe (live)',
  period: 'May 2026',
  recordCount: 1247,
  merkleRoot: '0x4a2f8c3d1e6b9f0a2d5c8e1b4f7a0d3c6e9b2f5a8d1c4e7b0a3f6c9d2e5b8a1c4',
}

// ─── AttestationConfirmModal ───────────────────────────────────────────────────

describe('AttestationConfirmModal', () => {
  describe('when closed', () => {
    it('renders nothing when open=false', () => {
      renderWithRouter(
        <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not run backdrop behavior while closed', () => {
      const onClose = vi.fn()
      const { container } = renderWithRouter(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={vi.fn()} />,
      )

      expect(container.querySelector('.modal-backdrop')).toBeNull()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not render the title when closed', () => {
      renderWithRouter(
        <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.queryByText(/confirm revenue attestation/i)).not.toBeInTheDocument()
    })
  })

  describe('when open — ARIA and structure', () => {
    it('renders a dialog element', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('dialog has aria-modal="true"', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('dialog has aria-labelledby pointing to the title', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-labelledby',
        'attest-modal-title',
      )
      expect(document.getElementById('attest-modal-title')).toHaveTextContent(
        /confirm revenue attestation/i,
      )
    })

    it('dialog has aria-describedby pointing to the description', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-describedby',
        'attest-modal-desc',
      )
      expect(document.getElementById('attest-modal-desc')).toBeInTheDocument()
    })

    it('renders the modal title', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(
        screen.getByRole('heading', { name: /confirm revenue attestation/i }),
      ).toBeInTheDocument()
    })

    it('renders the description text', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByText(/immutable on-chain record/i)).toBeInTheDocument()
    })

    it('renders the warning about irreversibility', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    })

    it('renders the close button with accessible label', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument()
    })

    it('renders Cancel button', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    })

    it('renders Confirm & Attest button', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.getByRole('button', { name: /confirm & attest/i })).toBeInTheDocument()
    })
  })

  describe('attestation details', () => {
    it('shows source when details are provided', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      expect(screen.getByText('Stripe (live)')).toBeInTheDocument()
    })

    it('shows period when details are provided', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      expect(screen.getByText('May 2026')).toBeInTheDocument()
    })

    it('shows formatted record count', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      expect(screen.getByText(/1,247 transactions/i)).toBeInTheDocument()
    })

    it('shows truncated Merkle root', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      expect(screen.getByText(/0x4a2f8c3d1e6b9f0a/)).toBeInTheDocument()
    })

    it('shows loading placeholder when details are null', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={null} />,
      )
      expect(screen.getByText(/loading attestation details/i)).toBeInTheDocument()
    })

    it('loading placeholder has aria-busy="true"', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={null} />,
      )
      expect(screen.getByText(/loading attestation details/i)).toHaveAttribute(
        'aria-busy',
        'true',
      )
    })

    it('does not show summary dl when details are null', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={null} />,
      )
      expect(screen.queryByRole('term')).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message with role="alert" when error is set', () => {
      renderWithRouter(
        <AttestationConfirmModal
          open
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          error="Network timeout. Please retry."
        />,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/network timeout/i)
    })

    it('does not render alert when error is null', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} error={null} />,
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not render alert when error is undefined (default)', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows "Attesting…" on the confirm button when loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading />,
      )
      expect(screen.getByRole('button', { name: /attesting/i })).toBeInTheDocument()
    })

    it('confirm button is disabled when loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading />,
      )
      expect(screen.getByRole('button', { name: /attesting/i })).toBeDisabled()
    })

    it('confirm button has aria-busy="true" when loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading />,
      )
      expect(screen.getByRole('button', { name: /attesting/i })).toHaveAttribute(
        'aria-busy',
        'true',
      )
    })

    it('cancel button is disabled when loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading />,
      )
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()
    })

    it('close button remains enabled during loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading />,
      )
      expect(screen.getByRole('button', { name: /close dialog/i })).not.toBeDisabled()
    })

    it('confirm button has aria-busy="false" when not loading', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} isLoading={false} />,
      )
      expect(
        screen.getByRole('button', { name: /confirm & attest/i }),
      ).toHaveAttribute('aria-busy', 'false')
    })
  })

  describe('dismissal actions', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.click(container.querySelector('.modal-backdrop')!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does NOT call onClose when clicking inside the dialog', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.click(screen.getByRole('dialog'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('does NOT call onClose on backdrop click when loading', () => {
      const onClose = vi.fn()
      const { container } = renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} isLoading />,
      )
      fireEvent.click(container.querySelector('.modal-backdrop')!)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onConfirm when Confirm & Attest is clicked', () => {
      const onConfirm = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={onConfirm} />,
      )
      fireEvent.click(screen.getByRole('button', { name: /confirm & attest/i }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleBackdropClick branch (src/components/AttestationConfirmModal.tsx:89)', () => {
    function ControlledModalWrapper({ initialLoading = false }: { initialLoading?: boolean }) {
      const [open, setOpen] = useState(true)
      const [loading, setLoading] = useState(initialLoading)

      return (
        <div>
          <button type="button" onClick={() => setLoading(!loading)}>
            Toggle Loading
          </button>
          <AttestationConfirmModal
            open={open}
            onClose={() => setOpen(false)}
            onConfirm={vi.fn()}
            isLoading={loading}
            details={DEMO_DETAILS}
          />
        </div>
      )
    }

    it('does not dismiss modal or trigger onClose when backdrop is clicked while isLoading is true', () => {
      const onClose = vi.fn()
      const { container } = renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} isLoading={true} />,
      )

      const backdrop = container.querySelector('.modal-backdrop')
      expect(backdrop).toBeInTheDocument()

      fireEvent.click(backdrop!)

      // Assert non-invocation of callback (failure to dismiss branch)
      expect(onClose).not.toHaveBeenCalled()
      // Assert visible outcome: dialog remains visible and in loading state
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /attesting/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()
    })

    it('preserves visible modal state in controlled consumer when backdrop is clicked during loading', () => {
      const { container } = renderWithRouter(<ControlledModalWrapper initialLoading={true} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      const backdrop = container.querySelector('.modal-backdrop')
      fireEvent.click(backdrop!)

      // Modal must remain open and visible in DOM
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('triggers onClose and visibly dismisses modal when backdrop is clicked and isLoading is false', () => {
      const onClose = vi.fn()
      const { container } = renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} isLoading={false} />,
      )

      const backdrop = container.querySelector('.modal-backdrop')
      fireEvent.click(backdrop!)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('visibly unmounts modal in controlled consumer when backdrop is clicked and not loading', () => {
      const { container } = renderWithRouter(<ControlledModalWrapper initialLoading={false} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      const backdrop = container.querySelector('.modal-backdrop')
      fireEvent.click(backdrop!)

      // Visible outcome: dialog is removed from the DOM
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('handles dynamic isLoading state transitions on backdrop click deterministically', () => {
      const { container } = renderWithRouter(<ControlledModalWrapper initialLoading={true} />)

      const backdrop = container.querySelector('.modal-backdrop')
      // While loading, backdrop click should not close modal
      fireEvent.click(backdrop!)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Toggle loading to false
      fireEvent.click(screen.getByRole('button', { name: /toggle loading/i }))

      // Now backdrop click should dismiss modal
      fireEvent.click(backdrop!)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not trigger handleBackdropClick when clicking inside modal dialog content', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} isLoading={false} />,
      )

      fireEvent.click(screen.getByRole('dialog'))
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('keyboard interactions', () => {
    it('Escape key calls onClose', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Escape key does nothing when modal is closed (no listener)', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('other keys do not call onClose', () => {
      const onClose = vi.fn()
      renderWithRouter(
        <AttestationConfirmModal open onClose={onClose} onConfirm={vi.fn()} />,
      )
      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('Tab from last focusable wraps to first (focus trap)', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      const dialog = screen.getByRole('dialog')
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      const last = focusable[focusable.length - 1]
      const first = focusable[0]

      last.focus()
      expect(document.activeElement).toBe(last)

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
      expect(document.activeElement).toBe(first)
    })

    it('Shift+Tab from first focusable wraps to last (focus trap)', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      const dialog = screen.getByRole('dialog')
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      first.focus()
      expect(document.activeElement).toBe(first)

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(last)
    })

    it('Tab from non-last element does not wrap (browser handles naturally)', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      const dialog = screen.getByRole('dialog')
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      // Focus an element that is not the last
      if (focusable.length > 1) {
        focusable[0].focus()
        const before = document.activeElement
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
        // Focus should stay on the same element (no custom wrapping triggered)
        expect(document.activeElement).toBe(before)
      }
    })

    it('Shift+Tab from non-first element does not wrap', () => {
      renderWithRouter(
        <AttestationConfirmModal open onClose={vi.fn()} onConfirm={vi.fn()} details={DEMO_DETAILS} />,
      )
      const dialog = screen.getByRole('dialog')
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      if (focusable.length > 1) {
        focusable[focusable.length - 1].focus()
        const before = document.activeElement
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(before)
      }
    })
  })

  describe('focus management', () => {
    it('moves focus to dialog when modal opens', () => {
      const { rerender } = renderWithRouter(
        <AttestationConfirmModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
      )
      rerender(
        <MemoryRouter>
          <AttestationConfirmModal open={true} onClose={vi.fn()} onConfirm={vi.fn()} />
        </MemoryRouter>,
      )
      expect(document.activeElement).toBe(screen.getByRole('dialog'))
    })

    it('restores focus to the trigger element when modal closes', () => {
      function Wrapper() {
        const [open, setOpen] = useState(false)
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open modal
            </button>
            <AttestationConfirmModal
              open={open}
              onClose={() => setOpen(false)}
              onConfirm={vi.fn()}
              details={DEMO_DETAILS}
            />
          </>
        )
      }
      renderWithRouter(<Wrapper />)
      const trigger = screen.getByRole('button', { name: /open modal/i })

      trigger.focus()
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(document.activeElement).toBe(trigger)
    })
  })
})

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('Dashboard', () => {
  it('renders the Dashboard heading', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument()
  })

  it('renders the quick actions section', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument()
  })

  it('renders "Trigger monthly revenue report" as a button', () => {
    renderWithRouter(<Dashboard />)
    expect(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    ).toBeInTheDocument()
  })

  it('modal is not visible initially', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the confirmation modal when trigger button is clicked', () => {
    renderWithRouter(<Dashboard />)
    fireEvent.click(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /confirm revenue attestation/i }),
    ).toBeInTheDocument()
  })

  it('closes modal when Cancel is clicked', () => {
    renderWithRouter(<Dashboard />)
    fireEvent.click(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes modal when close button is clicked', () => {
    renderWithRouter(<Dashboard />)
    fireEvent.click(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows attestation details in the modal', () => {
    renderWithRouter(<Dashboard />)
    fireEvent.click(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    )
    expect(screen.getByText('Stripe (live)')).toBeInTheDocument()
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    expect(screen.getByText(/1,247 transactions/i)).toBeInTheDocument()
  })

  it('closes modal after successful confirm', async () => {
    renderWithRouter(<Dashboard />)
    fireEvent.click(
      screen.getByRole('button', { name: /trigger monthly revenue report/i }),
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm & attest/i }))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('can reopen modal after closing', () => {
    renderWithRouter(<Dashboard />)
    const trigger = screen.getByRole('button', { name: /trigger monthly revenue report/i })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes modal when backdrop is clicked', () => {
    const { container } = renderWithRouter(<Dashboard />)
    const trigger = screen.getByRole('button', { name: /trigger monthly revenue report/i })

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const backdrop = container.querySelector('.modal-backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ─── AttestationConfirmModal: focus-trap forward-wrap branch ──────────────────

describe('AttestationConfirmModal — focus trap forward-wrap branch (line 78)', () => {
  // AttestationConfirmModal.tsx:78 is:
  //   } else if (!e.shiftKey && document.activeElement === last) {
  //     e.preventDefault()
  //     first.focus()
  //   }
  // The existing suite asserts the resulting focus move but never observes
  // e.preventDefault(), which is the branch's actual side effect and is
  // invisible in jsdom unless asserted directly. These cases pin the branch,
  // its !shiftKey guard, and the single-focusable (loading) boundary.

  function openModal(options: { isLoading?: boolean } = {}) {
    const onClose = vi.fn()
    renderWithRouter(
      <AttestationConfirmModal
        open
        onClose={onClose}
        onConfirm={vi.fn()}
        details={DEMO_DETAILS}
        isLoading={options.isLoading}
      />,
    )
    const dialog = screen.getByRole('dialog')
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
    )
    return {
      dialog,
      focusable,
      first: focusable[0],
      last: focusable[focusable.length - 1],
      onClose,
    }
  }

  function pressTab(shiftKey: boolean) {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)
    return event
  }

  it('wraps from the last control to the first AND prevents the default Tab', () => {
    const { first, last } = openModal()
    expect(first).toBeDefined()
    expect(last).toBeDefined()
    last!.focus()
    expect(document.activeElement).toBe(last)

    const event = pressTab(false)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
  })

  it('does not hijack Shift+Tab from the last control (the !shiftKey guard)', () => {
    const { last } = openModal()
    last!.focus()

    const event = pressTab(true)

    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(last)
  })

  it('keeps focus inside when loading leaves a single focusable control (first === last)', () => {
    const { focusable } = openModal({ isLoading: true })
    expect(focusable).toHaveLength(1)
    const only = focusable[0]!
    only.focus()

    const event = pressTab(false)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(only)
  })

  it('leaves the default Tab untouched from a non-boundary control', () => {
    const { focusable } = openModal()
    expect(focusable.length).toBeGreaterThanOrEqual(3)
    const middle = focusable[1]!
    middle.focus()

    const event = pressTab(false)

    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(middle)
  })
})
