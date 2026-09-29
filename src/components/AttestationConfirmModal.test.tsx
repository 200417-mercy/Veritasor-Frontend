import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import AttestationConfirmModal, {
  AttestationDetails,
  AttestationConfirmModalProps,
  FeeInfo,
} from './AttestationConfirmModal'

const details: AttestationDetails = {
  source: 'stripe',
  period: '2026-08',
  recordCount: 1234,
  merkleRoot: '0xabcdef1234567890abcdef1234567890abcdef12',
}

const feeInfo: FeeInfo = {
  total: 1.5,
  breakdown: [
    { label: 'Network fee', amount: 1 },
    { label: 'Service fee', amount: 0.5 },
  ],
}

function setup(overrides: Partial<AttestationConfirmModalProps> = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  const view = render(
    <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} {...overrides} />,
  )
  return { onClose, onConfirm, ...view }
}

function getCloseButton() {
  return screen.getByRole('button', { name: 'Close dialog' })
}

function getCancelButton() {
  return screen.getByRole('button', { name: 'Cancel' })
}

function getConfirmButton() {
  return screen.getByRole('button', { name: 'Confirm & Attest' })
}

function getFeeToggleButton() {
  return screen.getByRole('button', { name: 'View breakdown' })
}

describe('AttestationConfirmModal', () => {
  describe('Rendering', () => {
    it('renders the dialog with its title and details when open', () => {
      setup({ details, feeInfo })

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Confirm Revenue Attestation' }),
      ).toBeInTheDocument()
      expect(screen.getByText('stripe')).toBeInTheDocument()
      expect(screen.getByText('2026-08')).toBeInTheDocument()
      expect(screen.getByText('1,234 transactions')).toBeInTheDocument()
      expect(screen.getByText(/0xabcdef1234567890/)).toBeInTheDocument()
      expect(screen.getByText('1.5 XLM')).toBeInTheDocument()
    })

    it('renders a loading placeholder when details are not provided', () => {
      setup({ details: null, feeInfo: null })

      expect(screen.getByText('Loading attestation details…')).toBeInTheDocument()
      expect(screen.getByText('Calculating fee…')).toBeInTheDocument()
      expect(screen.queryByLabelText('Attestation details')).not.toBeInTheDocument()
    })

    it('renders nothing when open is false', () => {
      const { container } = setup({ open: false, details, feeInfo })

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Focus management', () => {
    it('moves focus to the dialog when it opens', () => {
      setup({ details, feeInfo })

      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    it('wraps focus from the first focusable element to the last on Shift+Tab', () => {
      setup({ details, feeInfo })

      const closeButton = getCloseButton()
      const confirmButton = getConfirmButton()

      closeButton.focus()
      expect(closeButton).toHaveFocus()

      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })

      expect(confirmButton).toHaveFocus()
    })

    it('wraps focus from the last focusable element to the first on Tab', () => {
      setup({ details, feeInfo })

      const closeButton = getCloseButton()
      const confirmButton = getConfirmButton()

      confirmButton.focus()
      expect(confirmButton).toHaveFocus()

      fireEvent.keyDown(confirmButton, { key: 'Tab' })

      expect(closeButton).toHaveFocus()
    })

    it('keeps focus inside the modal when Tab is pressed on a middle focusable element', () => {
      setup({ details, feeInfo })

      const cancelButton = getCancelButton()
      const dialog = screen.getByRole('dialog')

      cancelButton.focus()
      expect(cancelButton).toHaveFocus()

      fireEvent.keyDown(cancelButton, { key: 'Tab' })

      expect(cancelButton).toHaveFocus()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    })

    it('does not wrap on Shift+Tab when focus is not on the first focusable element', () => {
      setup({ details, feeInfo })

      const cancelButton = getCancelButton()

      cancelButton.focus()
      fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true })

      expect(cancelButton).toHaveFocus()
      expect(getConfirmButton()).not.toHaveFocus()
    })

    it('keeps the Shift+Tab wrap working when a fee breakdown toggle adds a focusable element', () => {
      setup({ details, feeInfo })

      const closeButton = getCloseButton()
      const confirmButton = getConfirmButton()
      const feeToggleButton = getFeeToggleButton()

      // The toggle sits between the close button and the footer buttons.
      feeToggleButton.focus()
      fireEvent.keyDown(feeToggleButton, { key: 'Tab', shiftKey: true })
      expect(feeToggleButton).toHaveFocus()

      // The last focusable element is still the confirm button, so the wrap still lands there.
      closeButton.focus()
      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
      expect(confirmButton).toHaveFocus()
    })

    it('restores focus to the trigger element when the modal closes', () => {
      const trigger = document.createElement('button')
      trigger.textContent = 'Open attestation'
      document.body.appendChild(trigger)
      trigger.focus()
      expect(trigger).toHaveFocus()

      try {
        const onClose = vi.fn()
        const onConfirm = vi.fn()
        const { rerender } = render(
          <AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />,
        )
        expect(screen.getByRole('dialog')).toHaveFocus()

        rerender(<AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
      } finally {
        trigger.remove()
      }
    })

    it('moves focus into the dialog when it is opened by a rerender', () => {
      const onClose = vi.fn()
      const onConfirm = vi.fn()
      const { rerender } = render(
        <AttestationConfirmModal open={false} onClose={onClose} onConfirm={onConfirm} />,
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      rerender(<AttestationConfirmModal open onClose={onClose} onConfirm={onConfirm} />)

      expect(screen.getByRole('dialog')).toHaveFocus()
    })
  })

  describe('Dismissal', () => {
    it('calls onClose when Escape is pressed', () => {
      const { onClose } = setup({ details, feeInfo })

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when Escape is pressed while closed', () => {
      const { onClose } = setup({ open: false, details, feeInfo })

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onClose when the backdrop is clicked', () => {
      const { onClose } = setup({ details, feeInfo })

      const backdrop = screen.getByRole('dialog').parentElement
      expect(backdrop).not.toBeNull()
      fireEvent.click(backdrop as HTMLElement)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when a click lands inside the dialog', () => {
      const { onClose } = setup({ details, feeInfo })

      fireEvent.click(screen.getByRole('dialog'))

      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not call onClose on a backdrop click while loading', () => {
      const { onClose } = setup({ details, feeInfo, isLoading: true })

      const backdrop = screen.getByRole('dialog').parentElement
      fireEvent.click(backdrop as HTMLElement)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('wraps focus between the single focusable element when the action buttons are disabled', () => {
      // With no fee info the only focusable element is the header close button.
      setup({ details, feeInfo: null, isLoading: true })

      const closeButton = getCloseButton()
      expect(getCancelButton()).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Attesting…' })).toBeDisabled()

      closeButton.focus()
      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
      expect(closeButton).toHaveFocus()

      fireEvent.keyDown(closeButton, { key: 'Tab' })
      expect(closeButton).toHaveFocus()
    })

    it('skips disabled action buttons when wrapping focus', () => {
      // The fee toggle stays enabled while loading, so it becomes the last focusable element.
      setup({ details, feeInfo, isLoading: true })

      const closeButton = getCloseButton()
      const feeToggleButton = getFeeToggleButton()
      expect(getCancelButton()).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Attesting…' })).toBeDisabled()

      closeButton.focus()
      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
      expect(feeToggleButton).toHaveFocus()

      fireEvent.keyDown(feeToggleButton, { key: 'Tab' })
      expect(closeButton).toHaveFocus()
    })

    it('renders the error alert and still wraps focus on Shift+Tab', () => {
      setup({ details, feeInfo, error: 'Attestation submission failed' })

      expect(screen.getByRole('alert')).toHaveTextContent('Attestation submission failed')

      const closeButton = getCloseButton()
      closeButton.focus()
      fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })

      expect(getConfirmButton()).toHaveFocus()
    })
  })
})
