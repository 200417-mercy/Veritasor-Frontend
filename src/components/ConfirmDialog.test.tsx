import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    description: 'Are you sure you want to do this?',
    confirmText: 'Yes',
    cancelText: 'No',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly when open is true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to do this?')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Yes'))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('No'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close icon is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Close dialog'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when backdrop is clicked if isLoading is true', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} isLoading={true} />)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('disables buttons and shows "Working…" when isLoading is true', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)
    const confirmButton = screen.getByText('Working…')
    const cancelButton = screen.getByText('No')
    expect(confirmButton).toBeDisabled()
    expect(confirmButton).toHaveAttribute('aria-busy', 'true')
    expect(cancelButton).toBeDisabled()
  })

  it('calls onClose when Escape key is pressed', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus inside the dialog using Tab key', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const closeIcon = screen.getByLabelText('Close dialog')
    const cancelButton = screen.getByText('No')
    const confirmButton = screen.getByText('Yes')

    // Simulate being on the last focusable element and pressing Tab
    confirmButton.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(closeIcon)

    // Simulate being on the first focusable element and pressing Shift+Tab
    closeIcon.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
  })

  it('applies danger tone styles correctly', () => {
    render(<ConfirmDialog {...defaultProps} tone="danger" />)
    const confirmButton = screen.getByText('Yes')
    expect(confirmButton).toHaveStyle('color: rgb(4, 17, 31)') // Need to convert to RGB or check applied styles
    // We can also check if style property exists
  })
})
