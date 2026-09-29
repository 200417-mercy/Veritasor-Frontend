import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import DirtyStateBanner from './DirtyStateBanner'

const defaultProps = {
  isDirty: false,
  saveStatus: 'idle' as const,
  lastSavedAt: null,
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  formLabel: 'Profile',
}

describe('DirtyStateBanner', () => {
  it('stays hidden when the form is idle and clean', () => {
    render(<DirtyStateBanner {...defaultProps} />)

    expect(screen.queryByRole('region', { name: 'Profile save status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes in Profile' })).not.toBeInTheDocument()
  })

  it('shows dirty state and discards changes on request', () => {
    const onDiscard = vi.fn()
    render(<DirtyStateBanner {...defaultProps} isDirty saveStatus="dirty" onDiscard={onDiscard} />)

    expect(screen.getByRole('region', { name: 'Profile save status' })).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByText('Draft auto-saved locally')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Discard unsaved changes in Profile' }))

    expect(onDiscard).toHaveBeenCalledOnce()
    expect(screen.queryByRole('region', { name: 'Profile save status' })).not.toBeInTheDocument()
  })

  it('dismisses with Escape and becomes visible again when dirty state returns', () => {
    const { rerender } = render(<DirtyStateBanner {...defaultProps} isDirty saveStatus="dirty" />)

    fireEvent.keyDown(document, { key: 'Escape', cancelable: true })
    expect(screen.queryByRole('region', { name: 'Profile save status' })).not.toBeInTheDocument()

    rerender(<DirtyStateBanner {...defaultProps} />)
    rerender(<DirtyStateBanner {...defaultProps} isDirty saveStatus="dirty" />)

    expect(screen.getByRole('region', { name: 'Profile save status' })).toBeInTheDocument()
  })

  it('restores retry controls after a failed save returns to dirty state', () => {
    const { rerender } = render(<DirtyStateBanner {...defaultProps} isDirty saveStatus="saving" />)

    const saveButton = screen.getByRole('button', { name: 'Save changes in Profile' })
    expect(saveButton).toHaveTextContent('Saving…')
    expect(saveButton).toBeDisabled()

    rerender(<DirtyStateBanner {...defaultProps} isDirty saveStatus="dirty" />)

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(saveButton).toBeEnabled()
  })

  it('keeps Save busy until an asynchronous save succeeds', async () => {
    let resolveSave!: () => void
    const onSave = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))
    render(<DirtyStateBanner {...defaultProps} isDirty saveStatus="dirty" onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes in Profile' }))

    const saveButton = screen.getByRole('button', { name: 'Save changes in Profile' })
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('aria-busy', 'true')
    expect(onSave).toHaveBeenCalledOnce()

    await act(async () => resolveSave())
    await waitFor(() => expect(saveButton).toBeEnabled())
  })

  it('renders an invalid saved timestamp without throwing', () => {
    render(
      <DirtyStateBanner
        {...defaultProps}
        saveStatus="saved"
        lastSavedAt={new Date(Number.NaN)}
      />,
    )

    expect(screen.getByRole('region', { name: 'Profile save status' })).toBeInTheDocument()
    expect(screen.getByText('Invalid Date')).toBeInTheDocument()
  })
})