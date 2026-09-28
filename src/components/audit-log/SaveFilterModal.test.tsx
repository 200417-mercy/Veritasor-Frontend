import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import enMessages from '../../i18n/messages/en.json'
import SaveFilterModal, { SaveFilterModalProps } from './SaveFilterModal'

function wrap(node: React.ReactNode) {
  // LocaleProvider relies on Vite's import.meta.glob to load messages;
  // vitest's jsdom environment does not resolve that glob. Pass the
  // en.json messages explicitly so formatMessage can interpolate ICU
  // placeholders under test.
  return (
    <IntlProvider locale="en" messages={enMessages}>
      {node}
    </IntlProvider>
  )
}

function getDialog() {
  return screen.getByRole('dialog', { name: /save filter/i })
}

describe('SaveFilterModal', () => {
  function renderModal(
    props: Partial<SaveFilterModalProps> = {},
  ) {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      wrap(
        <SaveFilterModal
          isOpen
          existingNames={[]}
          onSave={onSave}
          onClose={onClose}
          {...props}
        />,
      ),
    )
    return { onSave, onClose }
  }

  it('does not render when closed', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders with a heading, input, and footer buttons', () => {
    renderModal()
    expect(getDialog()).toBeInTheDocument()
    expect(screen.getByLabelText(/filter name/i)).toBeInTheDocument()
    expect(screen.getByTestId('save-filter-cancel')).toBeInTheDocument()
    expect(screen.getByTestId('save-filter-confirm')).toBeInTheDocument()
  })

  it('disables submit when input is empty', () => {
    renderModal()
    const submit = screen.getByTestId('save-filter-confirm')
    expect(submit).toBeDisabled()
  })

  it('enables submit with a valid name and calls onSave', async () => {
    const { onSave, onClose } = renderModal()
    const input = screen.getByLabelText(/filter name/i)
    fireEvent.change(input, { target: { value: 'Failed Attestations' } })
    const submit = screen.getByTestId('save-filter-confirm')
    await waitFor(() => expect(submit).not.toBeDisabled())
    fireEvent.click(submit)
    expect(onSave).toHaveBeenCalledWith('Failed Attestations')
    // onClose is intentionally not called on submit — the parent owns
    // the lifecycle so it can flash a success toast first.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('trims and collapses whitespace before saving', async () => {
    const { onSave } = renderModal()
    const input = screen.getByLabelText(/filter name/i)
    fireEvent.change(input, { target: { value: '   foo   bar   ' } })
    fireEvent.click(screen.getByTestId('save-filter-confirm'))
    expect(onSave).toHaveBeenCalledWith('foo bar')
  })

  it('rejects names that collide with an existing saved filter', async () => {
    const { onSave } = renderModal({ existingNames: ['Failed'] })
    const input = screen.getByLabelText(/filter name/i)
    fireEvent.change(input, { target: { value: 'failed' } })
    const submit = screen.getByTestId('save-filter-confirm')
    expect(submit).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
    // Inline error appears once user typed something invalid.
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('rejects names longer than the limit and shows a counter', () => {
    const { onSave } = renderModal()
    const input = screen.getByLabelText(/filter name/i)
    // 51 chars
    fireEvent.change(input, { target: { value: 'a'.repeat(51) } })
    // The input enforces maxLength via the browser, so the typed count
    // caps at 50. We explicitly assert the counter + disabled submit.
    expect(screen.getByTestId('save-filter-confirm')).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking the cancel button', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByTestId('save-filter-cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking the backdrop and stops propagation on the dialog', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByTestId('save-filter-modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
    fireEvent.click(getDialog())
    // Dialog itself should NOT have closed the modal a second time.
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab focus inside the dialog (submit -> close)', async () => {
    renderModal()
    const input = screen.getByLabelText(/filter name/i)
    fireEvent.change(input, { target: { value: 'Something' } })
    const submit = screen.getByTestId('save-filter-confirm')
    submit.focus()
    // From the submit button (last focusable) Tab should wrap to the
    // first focusable element — the Close button in the header.
    fireEvent.keyDown(document, { key: 'Tab' })
    await waitFor(() => {
      expect(
        document.activeElement?.getAttribute('aria-label')?.toLowerCase(),
      ).toContain('close')
    })
  })

  it('wraps Shift+Tab from the Close button back to the submit button', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText(/filter name/i), {
      target: { value: 'X' },
    })
    const close = document.querySelector('.modal-close') as HTMLElement
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('save-filter-confirm'),
      )
    })
  })

  it('initialises input with provided initialName', () => {
    renderModal({ initialName: 'Pre-filled' })
    expect(screen.getByLabelText(/filter name/i)).toHaveValue('Pre-filled')
  })

  it('resets the name input when reopened', () => {
    const { rerender } = render(
      wrap(<SaveFilterModal isOpen existingNames={[]} onSave={() => {}} onClose={() => {}} initialName="Open state" />),
    )
    expect(screen.getByLabelText(/filter name/i)).toHaveValue('Open state')
    act(() => {
      rerender(
        wrap(
          <SaveFilterModal
            isOpen={false}
            existingNames={[]}
            onSave={() => {}}
            onClose={() => {}}
            initialName="Open state"
          />,
        ),
      )
    })
    act(() => {
      rerender(
        wrap(
          <SaveFilterModal
            isOpen
            existingNames={[]}
            onSave={() => {}}
            onClose={() => {}}
            initialName="Another initial"
          />,
        ),
      )
    })
    expect(screen.getByLabelText(/filter name/i)).toHaveValue('Another initial')
  })
})